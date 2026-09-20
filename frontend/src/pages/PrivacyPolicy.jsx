import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';

// ---------------------------------------------------------------------------
// BEFORE GOING LIVE
//  1. Fill in every [PLACEHOLDER] below (organisation name, grievance officer,
//     retention periods, contact details).
//  2. Have a lawyer review the whole notice against the Digital Personal Data
//     Protection Act, 2023 and any rules that apply to your organisation.
//  3. Then set SHOW_DRAFT_BANNER to false.
// ---------------------------------------------------------------------------
const SHOW_DRAFT_BANNER = true;

const Section = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    <div className="text-sm text-gray-700 leading-relaxed space-y-2">{children}</div>
  </section>
);

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <span className="font-semibold text-gray-800">FarmFresh</span>
          </div>
          <Link to="/login" className="text-sm text-green-700 font-medium hover:underline">Back to login</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {SHOW_DRAFT_BANNER && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm rounded p-4">
            <strong>Draft.</strong> This notice has not been reviewed by a lawyer and still contains placeholders in
            [SQUARE BRACKETS]. It must be completed and reviewed before the platform is opened to real users.
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Privacy Notice and Terms of Use</h1>
          <p className="text-sm text-gray-500 mt-1">Last updated: [DATE]</p>
        </div>

        <Section title="1. Who we are">
          <p>
            FarmFresh is a platform run by [ORGANISATION NAME, ADDRESS] that connects Farmer Producer Organisations
            (FPOs) with consumers and gives the reviewing authority visibility into FPO registration and compliance.
          </p>
        </Section>

        <Section title="2. What personal data we collect">
          <p><strong>Consumers:</strong> name, email, phone number, location, delivery addresses, order and payment-method history, reviews.</p>
          <p><strong>FPO administrators and staff:</strong> name, email, phone, location, and the organisation's registration details (registration number, PAN, GSTIN, addresses, KYC documents).</p>
          <p>
            <strong>Farmers (entered by their FPO):</strong> name, phone, village, district and state, land holding, crops,
            member ID, gender and category where the FPO chooses to record them, the last four digits of the Aadhaar
            number, and bank account details used for payouts.
          </p>
        </Section>

        <Section title="3. Why we use it">
          <ul className="list-disc pl-5 space-y-1">
            <li>To create and secure accounts and let you log in.</li>
            <li>To process orders, deliveries, returns, subscriptions and invoices.</li>
            <li>To let FPOs record produce intake, grade it and pay farmers.</li>
            <li>To let the reviewing authority verify an FPO's identity and registration (KYC).</li>
            <li>To keep an audit trail of important actions and to prevent fraud and misuse.</li>
          </ul>
          <p>We use your data on the basis of your consent, given when you create an account, and where the law allows us to process it for these purposes.</p>
        </Section>

        <Section title="4. How we protect it">
          <ul className="list-disc pl-5 space-y-1">
            <li>Passwords are stored only as salted hashes, never in readable form.</li>
            <li>Aadhaar numbers are reduced to the last four digits when entered; the full number is not stored.</li>
            <li>Bank account numbers are encrypted in our database and shown masked. Only the FPO administrator can view a full number, and each such view is recorded.</li>
            <li>FPO staff accounts cannot see Aadhaar or bank details.</li>
            <li>KYC documents are stored privately. They can be opened only by the FPO that uploaded them and by the reviewing authority, and each authority view is recorded in the audit log.</li>
            <li>Actions by FPO administrators, FPO staff and the authority are written to an audit log.</li>
            <li>Access is limited by role, sign-in attempts are rate limited, and traffic should be served over HTTPS.</li>
          </ul>
          <p>No system is perfectly secure. If a personal data breach affects you, we will inform you and the relevant authority as the law requires.</p>
        </Section>

        <Section title="5. Who can see your data">
          <ul className="list-disc pl-5 space-y-1">
            <li>Consumers' names, delivery details and orders are visible to the FPO fulfilling the order.</li>
            <li>An FPO's registration details and KYC documents are visible to the reviewing authority.</li>
            <li>The public produce passport shows the batch, the FPO and the farmer's name and village. It does not show phone numbers.</li>
            <li>We do not sell personal data. We may disclose it where required by law. [ADD ANY SERVICE PROVIDERS, e.g. hosting, SMS, payments]</li>
          </ul>
        </Section>

        <Section title="6. How long we keep it">
          <p>We keep account and order records for [RETENTION PERIOD] and audit logs for [RETENTION PERIOD], unless the law requires longer. After that they are deleted or anonymised.</p>
        </Section>

        <Section title="7. Your rights">
          <p>
            You may ask to access the personal data we hold about you, to correct it, to have it erased where we are not
            required to keep it, and to withdraw your consent. Farmers whose details were entered by an FPO can make the same requests
            through that FPO or through us. To make a request, or to complain, contact our grievance officer:
          </p>
          <p className="font-medium">[NAME], [DESIGNATION] — [EMAIL] — [PHONE]</p>
        </Section>

        <Section title="8. Terms of use">
          <ul className="list-disc pl-5 space-y-1">
            <li>You must give accurate information, and keep your password confidential.</li>
            <li>FPOs are responsible for the accuracy of the farmer, batch, grading and pricing information they enter, and for having the farmers' permission to record their details.</li>
            <li>Uploading false registration or KYC documents may lead to rejection or removal of the FPO.</li>
            <li>We may suspend accounts that misuse the platform. [ADD LIABILITY, REFUND AND DISPUTE TERMS]</li>
          </ul>
        </Section>

        <Section title="9. Changes">
          <p>We may update this notice. Material changes will be shown in the app before they apply.</p>
        </Section>
      </main>
    </div>
  );
}
