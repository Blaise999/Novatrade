'use client';

import { Cookie } from 'lucide-react';

export default function CookiesPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center">
          <Cookie className="w-6 h-6 text-gold" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-cream">Cookie Policy</h1>
          <p className="text-sm text-cream/50">Last updated: January 2026</p>
        </div>
      </div>
      
      <div className="prose prose-invert max-w-none">
        <div className="space-y-6 text-cream/70">
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">What Are Cookies</h2>
            <p>
              Cookies are small text files stored on your device when you visit our website. They help us 
              provide you with a better experience and enable certain features to work properly.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Types of Cookies We Use</h2>
            
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-white/5 rounded-xl">
                <h3 className="text-cream font-medium mb-2">Essential Cookies</h3>
                <p className="text-sm">
                  Required for the website to function properly. These cannot be disabled.
                  Used for: Authentication, security, session management.
                </p>
              </div>
              
              <div className="p-4 bg-white/5 rounded-xl">
                <h3 className="text-cream font-medium mb-2">Performance Cookies</h3>
                <p className="text-sm">
                  Help us understand how visitors interact with our website.
                  Used for: Analytics, page load times, error tracking.
                </p>
              </div>
              
              <div className="p-4 bg-white/5 rounded-xl">
                <h3 className="text-cream font-medium mb-2">Functional Cookies</h3>
                <p className="text-sm">
                  Enable enhanced functionality and personalization.
                  Used for: Language preferences, remembered settings.
                </p>
              </div>
              
              <div className="p-4 bg-white/5 rounded-xl">
                <h3 className="text-cream font-medium mb-2">Marketing Cookies</h3>
                <p className="text-sm">
                  Used to track visitors across websites for advertising purposes.
                  Used for: Targeted advertising, campaign tracking.
                </p>
              </div>
            </div>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Third-Party Cookies</h2>
            <p>We may use third-party services that set their own cookies, including:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Google Analytics (website analytics)</li>
              <li>Payment processors (transaction processing)</li>
              <li>Customer support tools (live chat)</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Managing Cookies</h2>
            <p>
              You can manage your cookie preferences through your browser settings. Please note that 
              disabling certain cookies may affect the functionality of our website.
            </p>
            <p className="mt-2">
              Most browsers allow you to:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>View what cookies are stored</li>
              <li>Delete cookies individually or all at once</li>
              <li>Block third-party cookies</li>
              <li>Block all cookies from specific sites</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Updates to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time. Changes will be posted on this page 
              with an updated revision date.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Contact Us</h2>
            <p>
              If you have questions about our use of cookies, please contact us at privacy@novatrade.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
