'use client';

import { Scale } from 'lucide-react';

export default function AMLPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center">
          <Scale className="w-6 h-6 text-gold" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-cream">Anti-Money Laundering Policy</h1>
          <p className="text-sm text-cream/50">Last updated: January 2026</p>
        </div>
      </div>
      
      <div className="prose prose-invert max-w-none">
        <div className="space-y-6 text-cream/70">
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Our Commitment</h2>
            <p>
              NOVATrADE is committed to preventing money laundering, terrorist financing, and other 
              financial crimes. We maintain strict compliance with all applicable anti-money laundering 
              (AML) laws and regulations.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Know Your Customer (KYC)</h2>
            <p>We implement comprehensive KYC procedures, which include:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Identity verification using government-issued documents</li>
              <li>Proof of address verification</li>
              <li>Source of funds verification for large deposits</li>
              <li>Enhanced due diligence for high-risk customers</li>
              <li>Ongoing monitoring of customer activities</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Customer Identification</h2>
            <p>Before you can trade or withdraw funds, we require:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Valid government-issued ID (passport, driver's license, national ID)</li>
              <li>Proof of residence (utility bill, bank statement dated within 3 months)</li>
              <li>Selfie with ID for verification</li>
              <li>Additional documents may be required based on risk assessment</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Transaction Monitoring</h2>
            <p>
              We continuously monitor all transactions for suspicious activity. Our systems flag:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Unusual transaction patterns</li>
              <li>Large deposits or withdrawals</li>
              <li>Frequent changes in payment methods</li>
              <li>Transactions with high-risk jurisdictions</li>
              <li>Structuring attempts to avoid reporting thresholds</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Reporting Obligations</h2>
            <p>
              We are required to report suspicious activities to relevant authorities. This includes:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Filing Suspicious Activity Reports (SARs)</li>
              <li>Currency Transaction Reports for large transactions</li>
              <li>Compliance with law enforcement requests</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Prohibited Activities</h2>
            <p>The following activities are strictly prohibited:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Using false or stolen identities</li>
              <li>Structuring transactions to avoid reporting</li>
              <li>Transferring funds from illegal sources</li>
              <li>Using third-party accounts without authorization</li>
              <li>Any activity intended to disguise the origin of funds</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Account Restrictions</h2>
            <p>
              We reserve the right to suspend or terminate accounts if we suspect any violation of 
              this policy. Funds may be frozen pending investigation and may be reported to authorities.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Sanctions Compliance</h2>
            <p>
              We screen all customers against international sanctions lists including OFAC, UN, EU, 
              and other relevant sanctions programs. We do not provide services to sanctioned individuals, 
              entities, or countries.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Contact Our Compliance Team</h2>
            <p>
              For questions about our AML policy or to report suspicious activity, 
              contact us at compliance@novatrade.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
