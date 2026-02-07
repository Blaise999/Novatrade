'use client';

import { FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center">
          <FileText className="w-6 h-6 text-gold" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-cream">Terms of Service</h1>
          <p className="text-sm text-cream/50">Last updated: January 2026</p>
        </div>
      </div>
      
      <div className="prose prose-invert max-w-none">
        <div className="space-y-6 text-cream/70">
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using NOVATrADE's services, website, or mobile applications, you agree to be bound by these 
              Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">2. Eligibility</h2>
            <p>
              To use our services, you must be at least 18 years old and have the legal capacity to enter into binding 
              contracts. You must not be located in a jurisdiction where our services are prohibited.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">3. Account Registration</h2>
            <p>
              You agree to provide accurate and complete information when creating an account. You are responsible for 
              maintaining the confidentiality of your account credentials and for all activities under your account.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">4. Trading Services</h2>
            <p>
              NOVATrADE provides a platform for trading various financial instruments including cryptocurrencies, forex, 
              stocks, and commodities. All trades are executed at your own risk.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">5. Deposits and Withdrawals</h2>
            <p>
              You may deposit funds using approved payment methods. Withdrawals are subject to verification and may take 
              1-5 business days to process. Minimum withdrawal amounts and fees may apply.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">6. Prohibited Activities</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Use our services for illegal activities</li>
              <li>Manipulate markets or engage in fraudulent trading</li>
              <li>Use automated systems without authorization</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">7. Limitation of Liability</h2>
            <p>
              NOVATrADE shall not be liable for any indirect, incidental, or consequential damages arising from your use 
              of our services. Our total liability shall not exceed the fees paid by you in the past 12 months.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">8. Modifications</h2>
            <p>
              We reserve the right to modify these terms at any time. Changes will be effective upon posting to our 
              website. Your continued use constitutes acceptance of the modified terms.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">9. Contact</h2>
            <p>
              For questions about these Terms of Service, please contact us at legal@novatrade.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
