'use client';

import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center">
          <Shield className="w-6 h-6 text-gold" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-cream">Privacy Policy</h1>
          <p className="text-sm text-cream/50">Last updated: January 2026</p>
        </div>
      </div>
      
      <div className="prose prose-invert max-w-none">
        <div className="space-y-6 text-cream/70">
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, including:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Account information (name, email, phone number)</li>
              <li>Identity verification documents (KYC)</li>
              <li>Financial information (payment details, transaction history)</li>
              <li>Communication data (support tickets, emails)</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">2. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Provide and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Verify your identity and prevent fraud</li>
              <li>Comply with legal obligations</li>
              <li>Send promotional communications (with your consent)</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">3. Information Sharing</h2>
            <p>
              We do not sell your personal information. We may share your information with:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Service providers who assist our operations</li>
              <li>Law enforcement when required by law</li>
              <li>Financial institutions for payment processing</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">4. Data Security</h2>
            <p>
              We implement industry-standard security measures including encryption, secure servers, 
              and regular security audits to protect your data.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your data</li>
              <li>Object to data processing</li>
              <li>Data portability</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">6. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide services. 
              We may retain certain information for legal compliance purposes.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">7. Contact Us</h2>
            <p>
              For privacy-related inquiries, contact our Data Protection Officer at privacy@novatrade.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
