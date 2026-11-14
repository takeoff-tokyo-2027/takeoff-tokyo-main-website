import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "../styles/legal.css";

const documents = {
  terms: {
    title: "Terms & Conditions",
    content: <>
      <p>In these Terms and Conditions, the “Company” refers to NEW FOUNDATION which is an incorporated foundation under the laws of Japan whose registered office is at Tōkyō-to Shibuya-ku Ebisu 1-15-9 Shiruku Ebisu 403, or any of its affiliate companies such as TAKEOFF KK. These Terms and Conditions shall apply to the persons (“You”) who purchase a ticket of, register to, or attend any event (“Event”) organized by the Company.</p>
      <p>All registrations will be done through the online ticket purchase page (the “Ticket Shop”) and You will receive an order confirmation (the “Ticket”).</p>
      <p>By purchasing a Ticket, registering to or attending the Event, or using any related service provided by the Company ("Service”), You shall be deemed to have accepted and agreed to be bound by these Terms and Conditions. In addition, you shall be subject to any guidelines or rules applicable to such Ticket, Event, or Service posted by the Company. If You are a minor, You must obtain the prior consent of a parent or other legal representative.</p>
      <h2>Ticket Terms</h2>
      <ol>
        <li>All Ticket prices indicated on the Ticket Shop and the website of the Company or each Event (the “Website”) include Tax.</li>
        <li>All Tickets are personal and must be assigned to an attendee. All required attendee details must be provided at least 7 days before the Event (or if the Company specifies otherwise, before that date). The Company is not obligated to reassign Tickets after this date. If You fail to provide details as required in a timely fashion, The Company is not obligated to provide an Event Event Pass or wristband, etc.(the “Event Pass”) which is required to enter the venue of each Event.</li>
        <li>Discounted Tickets are only valid in combination in conjunction with an official identification qualifying for a discount.</li>
        <li>Identification must be presented at Event Pass pick-up and shown on request to gain admission to the Event venue. If no such verification is provided, the purchased Ticket is invalid, and You will not be granted access to the Event.</li>
        <li>Admission to the Event or conference will not be granted without full payment received prior to the Event.</li>
        <li>The Company is not responsible for replacing lost or damaged Event Passes.</li>
      </ol>
      <h2>Refund and Cancellation</h2>
      <ol>
        <li>All Ticket purchases and made at the Ticket Shop are final and Tickets are non-refundable. Please note that there is no cooling-off period nor a 14-day right to cancel purchases of Tickets to the Event.</li>
        <li>It is not permitted to allocate the Ticket to a third party unless otherwise expressly allowed by the Company.</li>
        <li>Even if the Tiecket is allocated to a third party pursuant to the preceding paragraph, it is not possible to change the person or organization liable for the payment.</li>
        <li>Tickets purchased are for Your own personal and may not be re-sold or transferred for commercial gain under any circumstances.</li>
        <li>Where there has been any re-sale or attempted re-sale of any Tickets (or any other breach of this term), the Company reserves the right to cancel the relevant Tickets with immediate effect without refund.</li>
        <li>The Company is not liable for the granting of any VISAs that are required to attend any Event or conference. In the event that an attendee's VISA is not granted, Tickets will not be refunded for any Event.</li>
        <li>If an Event is canceled due to a cause attributable to the Company (save for Force Majeure Events), the Company will reimburse you such the price of the ticket, as set out by the Company. In such cases, The Company will instruct You on the reimbursement.</li>
      </ol>
      <h2>Event Pass Pick-Up</h2>
      <ol>
        <li>A physical Event Pass must be picked up before entering the Event. A Ticket alone is not sufficient to access the Event.</li>
        <li>The Event Pass pick-up locations and opening hours will be communicated on the Website and by email prior to the Event.</li>
        <li>When picking up the Event Pass, You must show the Ticket provided by e-mail as well as a valid photo ID.</li>
        <li>In the case of group order, the dedicated contact person can pick up Event Passes for everyone if informed of in advance.</li>
        <li>Each Ticket can be converted into the Event Pass only once.</li>
        <li>Once the Event Pass is printed, The Company is no longer obligated to make any changes.</li>
        <li>You agree to carry a photo identification with You at all times during the Event. You agree to show such identification upon request. If no such verification can be provided, the Company reserves the right to cancel the relevant Tickets with immediate effect without a refund.</li>
      </ol>
      <p>*persons found entering the Event unlawfully will be taken into police custody for whatever reasons and compensation for such actions will be charged.</p>
      <h2>The Company Name and Logo</h2>
      <p>Registering for and attending the Event does not grant You any rights to use the name of the Company or Events, or any of those logos without permission granted by the Company.</p>
      <h2>Event Cancellation, Postponement &amp; Substitution</h2>
      <ol>
        <li>The Company is not responsible for any loss or damage of any kind incurred as a result of substitution, alteration, cancellation, or postponement of an Event.</li>
        <li>In the event of an unexpected incident independent of The Company, The Company reserves the right to make changes to the date and time prior to the Event.</li>
        <li>In the case of rescheduling an Event, Your Ticket may be returned by a deadline determined by The Company, however, preferably immediately after the announcement of the new Event date. After the deadline has expired, The Company will not receive any claims for reimbursement.</li>
        <li>The Company reserves the right to make changes to the Events prior to the date of the Event, if there is a justified reason such as an unexpected problem with the location, or if a speaker is prevented from participating.</li>
        <li>Please note that while speakers and topics are confirmed at the time of publishing, circumstances beyond the control of the organizers may necessitate substitutions, alterations, or cancellations of the speakers and/or topics. As such, the 6. Company reserves the right to alter or modify the advertised speakers and/or topics if necessary without any liability to you whatsoever.</li>
        <li value="7">Any substitutions or alterations will be updated on our Website as soon as possible.</li>
      </ol>
      <h2>Privacy</h2>
      <p>The Company shall handle Your personal information and personal data appropriately in accordance with our Privacy Policy.</p>
      <h2>Liability</h2>
      <ol>
        <li>The Company will not be liable for any loss, injury, or damage to any person or property howsoever caused before, after, or during the Events or conferences.</li>
        <li>The Company is not responsible for any Tickets/Event Passes that are lost or stolen.</li>
        <li>Each participant must make provision for his or her own insurance.</li>
        <li>You consent to film and sound recording as attendees at any Event.</li>
        <li>The Company reserves the right to refuse admission to any Event for any behavior, which it deems unacceptable, or for breach of these Terms and Conditions.</li>
      </ol>
      <h2>Change of Terms and Conditions</h2>
      <p>The Company may change these Terms and Conditions. In case these Terms and Conditions are to be changed, the Company will announce such changes on the Website at least one month in advance, as well as the content of the Terms and Conditions and the date when they will come into effect.</p>
      <h2>Governing Law and Jurisdictions</h2>
      <ol>
        <li>These Terms and Conditions shall be governed by the laws of Japan.</li>
        <li>Any disputes between You and the Company in relation to the Ticket purchase, Event, or Service shall be resolved upon the consultation in good faith between both parties. If the matter is not resolved through consultation, the Tokyo District Court or the Tokyo Summary Court shall be the court of exclusive jurisdiction of the first instance.</li>
      </ol>
      <p>Last updated: 1 June 2026</p>
    </>,
  },
  privacy: {
    title: "Privacy Policy",
    content: <>
      <p>This Privacy Policy outlines the practices of NEW FOUNDATION, its subsidiaries and affiliates (referred to as "our group") concerning the collection, use, and protection of personal information obtained from purchasers and users of our group's websites ("our group websites") and our group's goods and services ("our group services").</p>
      <p>Please refer to our group companies' information here: <Link to="/scta">https://www.takeoff-tokyo.com/scta</Link></p>
      <h2>Compliance with Laws and Regulations</h2>
      <p>Our group is committed to compliance with the Personal Information Protection Law, various guidelines issued by ministries and agencies, and other relevant laws and regulations to ensure the protection of personal information.</p>
      <h2>Purpose of Use</h2>
      <p>Our group will use information obtained from customers for purposes such as:</p>
      <ul>
        <li>Acceptance of registration for our group services, identity verification, and authentication of customers</li>
        <li>Management of the usage history of our group services by customers</li>
        <li>Settlement of usage fees</li>
        <li>Analysis of customer behavior history in our group services to help maintain and improve our group services</li>
        <li>Sending information about our group services</li>
        <li>Sending information about affiliated businesses and services</li>
        <li>Responding to inquiries from customers</li>
        <li>Responding to acts that violate our group's terms and conditions and laws and regulations</li>
        <li>Notifying changes in our group's terms and conditions of use</li>
        <li>Providing, maintaining, protecting, and improving our group services, and for other purposes.</li>
        <li>Using the email address for communication about the new opportunities related to Takeoff Tokyo from our group and our Partners</li>
      </ul>
      <h2>Provision to Third Parties</h2>
      <p>We will not provide personal data falling under the category of "personal data" under the Personal Information Protection Law to third parties without the customer's prior consent, except in cases such as outsourcing to external contractors, acquisition scenarios, or joint use with business partners.</p>
      <h2>Security Measures</h2>
      <p>Our group takes reasonable preventive measures to protect personal information collected, both online and offline. We have committed to raising awareness and promoting personal information protection among our officers and ensuring the proper handling of personal information by external contractors.</p>
      <h2>Use Beyond the Original Purpose of Collection</h2>
      <p>As a general rule, our group will not use personal information beyond the scope of the purpose of use stated in this privacy policy at the time of collection. Any changes will be made public on our group website.</p>
      <h2>Cookies and Analytics</h2>
      <p>Our group uses "Google Analytics," for customer access analysis. Google Analytics uses cookies to collect traffic data, collected anonymously. Users can refuse the collection of this information by disabling cookies in their browser settings.</p>
      <h2>Data Controller Details</h2>
      <p>Business Name: NEW FOUNDATION.</p>
      <p>For the business address and representative director, please refer to here: <Link to="/scta">takeoff-tokyo.com/scta</Link></p>
      <h2>Changes to the Privacy Policy</h2>
      <p>Our group may change the content of this Privacy Policy as necessary. In such cases, we will announce or notify the effective date and content of the revised Privacy Policy by an appropriate method.</p>
      <h2>Contact Us</h2>
      <p>If you have any questions or concerns about this privacy policy or wish to disclose, correct, suspend the use, or delete your personal information, please contact us at the following email address:</p>
      <p>Email: <a href="mailto:hello@takeoff-tokyo.com">hello@takeoff-tokyo.com</a></p>
      <p>In this case, we will confirm that it is a request from the individual concerned by a method specified by our group.</p>
      <p>Last updated: 1 June 2026</p>
    </>,
  },
  commercial: {
    title: "Commercial Disclosure",
    content: <dl>
      <div><dt>Entity Name</dt><dd>NEW FOUNDATION</dd></div>
      <div><dt>Representative</dt><dd>Antti Matias Sonninen</dd></div>
      <div><dt>Address</dt><dd>Tōkyō-to Shibuya-ku Ebisu 1-15-9 Shiruku Ebisu 403</dd></div>
      <div><dt>Email</dt><dd><a href="mailto:hello@takeoff-tokyo.com">hello@takeoff-tokyo.com</a></dd></div>
      <div><dt>Price</dt><dd>As indicated on the website (including tax)</dd></div>
      <div><dt>Payment Method</dt><dd>Credit Card</dd></div>
      <div><dt>Payment Deadline</dt><dd>Payment will be confirmed upon ordering the ticket</dd></div>
      <div><dt>Delivery Time</dt><dd>Immediately after the completion of ticket payment process</dd></div>
      <div><dt>Returns/Cancellations</dt><dd>Generally, returns and cancellations after purchasing tickets are not accepted</dd></div>
    </dl>,
  },
};

export const legalRoutes = {
  "/terms-conditions": "terms",
  "/terms-and-conditions": "terms",
  "/privacy-policy": "privacy",
  "/scta": "commercial",
  "/commercial-disclosure": "commercial",
} as const;

export function LegalPage({ document }: { document: typeof legalRoutes[keyof typeof legalRoutes] }) {
  const { title, content } = documents[document];
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previousTitle = window.document.title;
    window.document.title = `${title} | Takeoff Tokyo 2027`;
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
    return () => { window.document.title = previousTitle; };
  }, [title]);

  return (
    <main className="site-container legal-page">
      <Link className="legal-home" to="/">← Back to Takeoff Tokyo</Link>
      <article aria-labelledby="legal-title">
        <h1 id="legal-title" ref={heading} tabIndex={-1}>{title}</h1>
        {content}
      </article>
    </main>
  );
}
