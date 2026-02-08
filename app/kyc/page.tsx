'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  TrendingUp,
  User,
  MapPin,
  FileText,
  Camera,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Upload,
  X,
  Shield,
  Clock,
  Gift,
} from 'lucide-react';
import { useKYCStore } from '@/lib/store';
import { useStore } from '@/lib/supabase/store-supabase';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

// Validation schemas for each step
const personalInfoSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  nationality: z.string().min(1, 'Nationality is required'),
});

const addressSchema = z.object({
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postalCode: z.string().min(3, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
});

const documentSchema = z.object({
  idType: z.enum(['passport', 'drivers_license', 'national_id']),
  idNumber: z.string().min(5, 'ID number is required'),
});

const countries = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Japan',
  'Singapore',
  'Switzerland',
  'Netherlands',
  'Nigeria',
  'South Africa',
  'UAE',
  'India',
  'Brazil',
];

const nationalities = [
  'American',
  'British',
  'Canadian',
  'Australian',
  'German',
  'French',
  'Japanese',
  'Singaporean',
  'Swiss',
  'Dutch',
  'Nigerian',
  'South African',
  'Emirati',
  'Indian',
  'Brazilian',
];

export default function KYCPage() {
  const router = useRouter();
  const { user, isLoading, updateKycStatus } = useStore();
  const { currentStep, data, updateData, setStep, setSubmitting, isSubmitting } =
    useKYCStore();

  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [proofOfAddressFile, setProofOfAddressFile] = useState<File | null>(
    null
  );

  // ✅ NEW: Loud error surface
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Check authentication (wait for loading to finish first)
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  const steps = [
    { id: 1, title: 'Personal Info', icon: User },
    { id: 2, title: 'Address', icon: MapPin },
    { id: 3, title: 'Documents', icon: FileText },
    { id: 4, title: 'Selfie', icon: Camera },
  ];

  const handleNext = () => {
    if (currentStep < 4) setStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setStep(currentStep - 1);
  };

  // ✅ FULL FIX: KYC submission that FAILS LOUDLY
  const handleSubmitKYC = async () => {
    setSubmitError(null);
    setSubmitting(true);

    try {
      if (!user?.id) throw new Error('You must be logged in to submit KYC.');
      if (!isSupabaseConfigured())
        throw new Error('Supabase is not configured.');

      // Required docs (LOUD)
      if (!idFrontFile) throw new Error('Please upload the FRONT of your ID.');
      if (!selfieFile)
        throw new Error('Please upload your selfie holding the ID.');

      // If not passport, require back file (LOUD)
      const idType = data?.idType as
        | 'passport'
        | 'drivers_license'
        | 'national_id'
        | undefined;

      if (idType && idType !== 'passport' && !idBackFile) {
        throw new Error('Please upload the BACK of your ID.');
      }

      // Build metadata
      const kycMeta: Record<string, any> = {
        ...(data.firstName ? { first_name: data.firstName } : {}),
        ...(data.lastName ? { last_name: data.lastName } : {}),
        ...(data.dateOfBirth ? { date_of_birth: data.dateOfBirth } : {}),
        ...(data.nationality ? { nationality: data.nationality } : {}),
        ...(data.address ? { address: data.address } : {}),
        ...(data.city ? { city: data.city } : {}),
        ...(data.state ? { state: data.state } : {}),
        ...(data.postalCode ? { postal_code: data.postalCode } : {}),
        ...(data.country ? { country: data.country } : {}),
        ...(data.idType ? { id_type: data.idType } : {}),
        ...(data.idNumber ? { id_number: data.idNumber } : {}),
      };

      // Upload helper that throws (LOUD)
      const uploadFile = async (file: File | null, name: string) => {
        if (!file) return null;

        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
        const filePath = `kyc/${user.id}/${name}.${ext}`;

        const { error: uploadError } = await supabase.storage
         .from('kyc-documents')
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type || 'application/octet-stream',
            cacheControl: '3600',
          });

        if (uploadError) {
          throw new Error(`Upload failed for ${name}: ${uploadError.message}`);
        }

        return filePath;
      };

      // Upload (LOUD)
      const idFrontPath = await uploadFile(idFrontFile, 'id-front');
      const idBackPath = await uploadFile(idBackFile, 'id-back');
      const selfiePath = await uploadFile(selfieFile, 'selfie');
      const proofPath = await uploadFile(proofOfAddressFile, 'proof-of-address');

      if (idFrontPath) kycMeta.id_front_doc = idFrontPath;
      if (idBackPath) kycMeta.id_back_doc = idBackPath;
      if (selfiePath) kycMeta.selfie_doc = selfiePath;
      if (proofPath) kycMeta.proof_of_address_doc = proofPath;

      const nowIso = new Date().toISOString();

      // ✅ Use UPSERT so row always exists; VERIFY save
      const kycPayload: Record<string, any> = {
        id: user.id,
        kyc_status: 'pending',
        kyc_submitted_at: nowIso,
        ...(data.firstName ? { first_name: data.firstName } : {}),
        ...(data.lastName ? { last_name: data.lastName } : {}),
        kyc_data: kycMeta,
      };

      const { data: saved, error: saveErr } = await supabase
        .from('users')
        .upsert(kycPayload, { onConflict: 'id' })
        .select('id, kyc_status, kyc_submitted_at')
        .single();

      if (saveErr) throw new Error(`KYC save failed: ${saveErr.message}`);
      if (!saved?.id || saved.kyc_status !== 'pending') {
        throw new Error('KYC save failed: record not persisted correctly.');
      }

      // Only after DB success:
      await updateKycStatus('pending');
      setStep(5);
    } catch (e: any) {
      console.error('[KYC] Submit failed:', e);
      setSubmitError(e?.message || 'KYC submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-void">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-gold to-gold/60 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-void" />
            </div>
            <span className="text-xl font-display font-bold text-cream">
              NOVA<span className="text-gold">TRADE</span>
            </span>
          </Link>

          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-slate-400 hover:text-cream transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* If KYC already pending, show waiting screen */}
        {user?.kycStatus === 'pending' && currentStep !== 5 && (
          <div className="text-center py-12 space-y-6">
            <div className="w-20 h-20 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <Clock className="w-10 h-10 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-cream mb-3">
                Verification Under Review
              </h2>
              <p className="text-slate-400 leading-relaxed max-w-md mx-auto">
                Your identity verification documents have been submitted and are
                being reviewed by our team. This process typically takes 1-24
                hours.
              </p>
            </div>
            <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-5 max-w-sm mx-auto">
              <div className="flex items-center gap-2 text-yellow-400 font-medium mb-1">
                <Clock className="w-4 h-4" />
                Awaiting Admin Approval
              </div>
              <p className="text-xs text-slate-500">
                You&apos;ll be notified once your verification is complete.
                Trading and deposits will be unlocked after approval.
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3 bg-white/5 text-cream font-medium rounded-xl hover:bg-white/10 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* If KYC already verified, show success */}
        {(user?.kycStatus === 'verified' || user?.kycStatus === 'approved') &&
          currentStep !== 5 && (
            <div className="text-center py-12 space-y-6">
              <div className="w-20 h-20 bg-profit/10 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-profit" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-cream mb-3">
                  Identity Verified
                </h2>
                <p className="text-slate-400">
                  Your identity has been verified. You have full access to all
                  trading features.
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-8 py-3 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                Go to Dashboard
              </button>
            </div>
          )}

        {/* KYC Form - only show if not already pending or verified */}
        {(!user?.kycStatus ||
          user?.kycStatus === 'none' ||
          user?.kycStatus === 'not_started' ||
          user?.kycStatus === 'rejected' ||
          currentStep === 5) && (
          <>
            {/* Progress Steps */}
            {currentStep <= 4 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  {steps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                      <div
                        className={`flex flex-col items-center ${
                          index < steps.length - 1 ? 'flex-1' : ''
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                            currentStep > step.id
                              ? 'bg-profit border-profit'
                              : currentStep === step.id
                              ? 'bg-gold/20 border-gold'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          {currentStep > step.id ? (
                            <CheckCircle className="w-5 h-5 text-void" />
                          ) : (
                            <step.icon
                              className={`w-5 h-5 ${
                                currentStep === step.id
                                  ? 'text-gold'
                                  : 'text-slate-500'
                              }`}
                            />
                          )}
                        </div>
                        <span
                          className={`text-xs mt-2 ${
                            currentStep >= step.id ? 'text-cream' : 'text-slate-500'
                          }`}
                        >
                          {step.title}
                        </span>
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className={`h-0.5 w-full mx-2 mt-[-1.5rem] ${
                            currentStep > step.id ? 'bg-profit' : 'bg-white/10'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step Content */}
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <Step1PersonalInfo
                  key="step1"
                  data={data}
                  updateData={updateData}
                  onNext={handleNext}
                  nationalities={nationalities}
                />
              )}
              {currentStep === 2 && (
                <Step2Address
                  key="step2"
                  data={data}
                  updateData={updateData}
                  onNext={handleNext}
                  onBack={handleBack}
                  countries={countries}
                />
              )}
              {currentStep === 3 && (
                <Step3Documents
                  key="step3"
                  data={data}
                  updateData={updateData}
                  idFrontFile={idFrontFile}
                  setIdFrontFile={setIdFrontFile}
                  idBackFile={idBackFile}
                  setIdBackFile={setIdBackFile}
                  proofOfAddressFile={proofOfAddressFile}
                  setProofOfAddressFile={setProofOfAddressFile}
                  onNext={handleNext}
                  onBack={handleBack}
                />
              )}
              {currentStep === 4 && (
                <Step4Selfie
                  key="step4"
                  selfieFile={selfieFile}
                  setSelfieFile={setSelfieFile}
                  onSubmit={handleSubmitKYC}
                  onBack={handleBack}
                  isSubmitting={isSubmitting}
                  submitError={submitError}
                />
              )}
              {currentStep === 5 && <SuccessStep key="success" />}
            </AnimatePresence>
          </>
        )}
      </main>
    </div>
  );
}

// Step 1: Personal Information
function Step1PersonalInfo({ data, updateData, onNext, nationalities }: any) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      dateOfBirth: data.dateOfBirth || '',
      nationality: data.nationality || '',
    },
    mode: 'onChange',
  });

  const onSubmit = (formData: any) => {
    updateData(formData);
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-display font-bold text-cream">
          Personal Information
        </h2>
        <p className="mt-2 text-slate-400">
          Please enter your legal name as it appears on your ID.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-cream">First Name</label>
            <input
              {...register('firstName')}
              type="text"
              placeholder="John"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
            {errors.firstName && (
              <p className="text-sm text-loss">
                {errors.firstName.message as string}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-cream">Last Name</label>
            <input
              {...register('lastName')}
              type="text"
              placeholder="Doe"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
            {errors.lastName && (
              <p className="text-sm text-loss">
                {errors.lastName.message as string}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-cream">Date of Birth</label>
          <input
            {...register('dateOfBirth')}
            type="date"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
          {errors.dateOfBirth && (
            <p className="text-sm text-loss">
              {errors.dateOfBirth.message as string}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-cream">Nationality</label>
          <select
            {...register('nationality')}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            <option value="">Select nationality</option>
            {nationalities.map((nat: string) => (
              <option key={nat} value={nat} className="bg-obsidian">
                {nat}
              </option>
            ))}
          </select>
          {errors.nationality && (
            <p className="text-sm text-loss">
              {errors.nationality.message as string}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all flex items-center justify-center gap-2 group"
        >
          Continue
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </form>
    </motion.div>
  );
}

// Step 2: Address
function Step2Address({ data, updateData, onNext, onBack, countries }: any) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      postalCode: data.postalCode || '',
      country: data.country || '',
    },
    mode: 'onChange',
  });

  const onSubmit = (formData: any) => {
    updateData(formData);
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-display font-bold text-cream">
          Residential Address
        </h2>
        <p className="mt-2 text-slate-400">
          Enter your current residential address.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-cream">Street Address</label>
          <input
            {...register('address')}
            type="text"
            placeholder="123 Main Street, Apt 4B"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
          {errors.address && (
            <p className="text-sm text-loss">
              {errors.address.message as string}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-cream">City</label>
            <input
              {...register('city')}
              type="text"
              placeholder="New York"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
            {errors.city && (
              <p className="text-sm text-loss">
                {errors.city.message as string}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-cream">
              State/Province
            </label>
            <input
              {...register('state')}
              type="text"
              placeholder="NY"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
            {errors.state && (
              <p className="text-sm text-loss">
                {errors.state.message as string}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-cream">Postal Code</label>
            <input
              {...register('postalCode')}
              type="text"
              placeholder="10001"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
            {errors.postalCode && (
              <p className="text-sm text-loss">
                {errors.postalCode.message as string}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-cream">Country</label>
            <select
              {...register('country')}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              <option value="">Select country</option>
              {countries.map((country: string) => (
                <option key={country} value={country} className="bg-obsidian">
                  {country}
                </option>
              ))}
            </select>
            {errors.country && (
              <p className="text-sm text-loss">
                {errors.country.message as string}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-4 bg-white/5 border border-white/10 text-cream font-semibold rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <button
            type="submit"
            className="flex-1 py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all flex items-center justify-center gap-2 group"
          >
            Continue
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// Step 3: Documents
function Step3Documents({
  data,
  updateData,
  idFrontFile,
  setIdFrontFile,
  idBackFile,
  setIdBackFile,
  proofOfAddressFile,
  setProofOfAddressFile,
  onNext,
  onBack,
}: any) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      idType: data.idType || 'passport',
      idNumber: data.idNumber || '',
    },
    mode: 'onChange',
  });

  const idType = watch('idType');

  const onSubmit = (formData: any) => {
    updateData(formData);
    onNext();
  };

  const FileDropzone = ({ file, setFile, label, description }: any) => {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop: (acceptedFiles) => setFile(acceptedFiles[0]),
      accept: {
        'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
        'application/pdf': ['.pdf'],
      },
      maxFiles: 1,
      maxSize: 10 * 1024 * 1024,
    });

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-cream">{label}</label>
        {file ? (
          <div className="p-4 bg-profit/10 border border-profit/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-profit" />
              <span className="text-sm text-cream truncate max-w-[200px]">
                {file.name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-slate-400 hover:text-loss transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`p-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-gold bg-gold/5'
                : 'border-white/10 hover:border-white/20'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-cream mb-1">
              {isDragActive ? 'Drop file here' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-display font-bold text-cream">
          Identity Documents
        </h2>
        <p className="mt-2 text-slate-400">
          Upload clear photos of your government-issued ID.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-cream">Document Type</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'passport', label: 'Passport' },
              { value: 'drivers_license', label: "Driver's License" },
              { value: 'national_id', label: 'National ID' },
            ].map((type) => (
              <label
                key={type.value}
                className={`p-3 rounded-xl border cursor-pointer transition-all text-center ${
                  idType === type.value
                    ? 'border-gold bg-gold/10 text-cream'
                    : 'border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <input
                  {...register('idType')}
                  type="radio"
                  value={type.value}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-cream">
            Document Number
          </label>
          <input
            {...register('idNumber')}
            type="text"
            placeholder="Enter your ID number"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
          {errors.idNumber && (
            <p className="text-sm text-loss">
              {errors.idNumber.message as string}
            </p>
          )}
        </div>

        <FileDropzone
          file={idFrontFile}
          setFile={setIdFrontFile}
          label="Front of ID"
          description="JPG, PNG or PDF up to 10MB"
        />

        {idType !== 'passport' && (
          <FileDropzone
            file={idBackFile}
            setFile={setIdBackFile}
            label="Back of ID"
            description="JPG, PNG or PDF up to 10MB"
          />
        )}

        <FileDropzone
          file={proofOfAddressFile}
          setFile={setProofOfAddressFile}
          label="Proof of Address (Optional)"
          description="Utility bill or bank statement from last 3 months"
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-4 bg-white/5 border border-white/10 text-cream font-semibold rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <button
            type="submit"
            disabled={!idFrontFile}
            className="flex-1 py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
          >
            Continue
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// Step 4: Selfie Verification
function Step4Selfie({
  selfieFile,
  setSelfieFile,
  onSubmit,
  onBack,
  isSubmitting,
  submitError,
}: any) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => setSelfieFile(acceptedFiles[0]),
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {submitError && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/10">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">Submission failed</p>
            <p className="text-sm text-red-200/80">{submitError}</p>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-display font-bold text-cream">
          Selfie Verification
        </h2>
        <p className="mt-2 text-slate-400">
          Take a clear selfie holding your ID next to your face.
        </p>
      </div>

      <div className="bg-white/5 rounded-xl p-4 border border-white/5">
        <h3 className="text-sm font-medium text-cream mb-3">
          📸 Tips for a good photo:
        </h3>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-profit" />
            Ensure good lighting on your face
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-profit" />
            Hold your ID clearly visible next to your face
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-profit" />
            Remove glasses, hats, or face coverings
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-profit" />
            Use a plain background if possible
          </li>
        </ul>
      </div>

      {selfieFile ? (
        <div className="relative">
          <img
            src={URL.createObjectURL(selfieFile)}
            alt="Selfie preview"
            className="w-full h-64 object-cover rounded-xl"
          />
          <button
            onClick={() => setSelfieFile(null)}
            className="absolute top-2 right-2 w-8 h-8 bg-void/80 rounded-full flex items-center justify-center text-cream hover:bg-void transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`p-12 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-gold bg-gold/5'
              : 'border-white/10 hover:border-white/20'
          }`}
        >
          <input {...getInputProps()} />
          <Camera className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-lg text-cream mb-2">
            {isDragActive ? 'Drop your selfie here' : 'Upload your selfie'}
          </p>
          <p className="text-sm text-slate-500">JPG, PNG or WebP up to 10MB</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-4 bg-white/5 border border-white/10 text-cream font-semibold rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={!selfieFile || isSubmitting}
          className="flex-1 py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Submit for Review
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

// Success Step
function SuccessStep() {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-8 py-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="w-24 h-24 bg-profit/20 rounded-full flex items-center justify-center mx-auto"
      >
        <CheckCircle className="w-12 h-12 text-profit" />
      </motion.div>

      <div>
        <h2 className="text-3xl font-display font-bold text-cream">
          Verification Submitted!
        </h2>
        <p className="mt-4 text-slate-400 max-w-md mx-auto">
          Your documents have been submitted for review. We&apos;ll verify your
          identity within 24-48 hours.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
        <div className="p-4 bg-white/5 rounded-xl border border-white/5">
          <Clock className="w-6 h-6 text-gold mx-auto mb-2" />
          <p className="text-xs text-slate-400">Review Time</p>
          <p className="text-sm font-medium text-cream">24-48 hours</p>
        </div>
        <div className="p-4 bg-white/5 rounded-xl border border-white/5">
          <Shield className="w-6 h-6 text-gold mx-auto mb-2" />
          <p className="text-xs text-slate-400">Data Security</p>
          <p className="text-sm font-medium text-cream">Encrypted</p>
        </div>
        <div className="p-4 bg-white/5 rounded-xl border border-white/5">
          <Gift className="w-6 h-6 text-gold mx-auto mb-2" />
          <p className="text-xs text-slate-400">Bonus</p>
          <p className="text-sm font-medium text-cream">$100 USD</p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => router.push('/connect-wallet')}
          className="w-full max-w-md py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all"
        >
          Continue to Wallet Connection
        </button>
        <p className="text-xs text-slate-500 text-center">
          You can also connect your wallet later from Settings
        </p>
      </div>
    </motion.div>
  );
}
