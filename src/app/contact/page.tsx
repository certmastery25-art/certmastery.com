import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { CONTACT_EMAIL, CONTACT_LOCATION, CONTACT_PHONE, CONTACT_PHONE_HREF } from "@/lib/site";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <main className="main-content inner-page">
      <div className="page-heading">
        <p className="eyebrow">CONTACT</p>
        <h1>Get in touch.</h1>
        <p>Questions about the practice tests, labs or your account? Send us a message and we&apos;ll get back to you.</p>
      </div>
      <div className="contact-layout">
        <aside className="contact-details" aria-label="Contact details">
          <div className="contact-detail">
            <span className="contact-detail-icon"><Phone size={18} aria-hidden="true" /></span>
            <div><strong>Phone</strong><a href={CONTACT_PHONE_HREF}>{CONTACT_PHONE}</a></div>
          </div>
          <div className="contact-detail">
            <span className="contact-detail-icon"><Mail size={18} aria-hidden="true" /></span>
            <div><strong>Email</strong><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></div>
          </div>
          <div className="contact-detail">
            <span className="contact-detail-icon"><MapPin size={18} aria-hidden="true" /></span>
            <div><strong>Location</strong><span>{CONTACT_LOCATION}</span></div>
          </div>
        </aside>
        <section className="contact-panel" aria-label="Contact form">
          <ContactForm />
        </section>
      </div>
    </main>
  );
}
