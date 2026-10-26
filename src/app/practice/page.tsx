import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Clock3, SlidersHorizontal } from "lucide-react";
import { certificationIcon } from "@/lib/cert-icons";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Practice tests" };

// Matches the quiz runner's pace when a certification has no timed exam settings.
const SECONDS_PER_QUESTION = 90;

export default async function PracticeTestsPage() {
  const certifications = await prisma.certification.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, acronym: true, name: true, examCode: true, timedExamQuestions: true, timedExamMinutes: true, domains: { select: { _count: { select: { questions: true } } } } },
  });

  return (
    <main className="main-content inner-page">
      <div className="page-heading">
        <p className="eyebrow">Practice tests</p>
        <h1>Practise the way you will be tested.</h1>
        <p>Pick a certification, then choose untimed practice, a timed exam, or a custom quiz built around the domains you want to strengthen.</p>
      </div>

      <div className="mode-summary" aria-label="Study modes">
        <div><BookOpenCheck size={18} /><strong>Practice</strong><span>Untimed, with an explanation after every answer.</span></div>
        <div><Clock3 size={18} /><strong>Timed exam</strong><span>A full timed session at exam pace.</span></div>
        <div><SlidersHorizontal size={18} /><strong>Custom quiz</strong><span>Your choice of domain, difficulty, and length.</span></div>
      </div>

      <div className="table-card">
        <table className="practice-table">
          <thead><tr><th scope="col">Certification</th><th scope="col">Question bank</th><th scope="col">Timed exam</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
          <tbody>
            {certifications.map((certification) => {
              const Icon = certificationIcon(certification.slug);
              const total = certification.domains.reduce((sum, domain) => sum + domain._count.questions, 0);
              const secondsPerQuestion = certification.timedExamQuestions && certification.timedExamMinutes ? (certification.timedExamMinutes * 60) / certification.timedExamQuestions : SECONDS_PER_QUESTION;
              const timedQuestions = certification.timedExamQuestions ? Math.min(certification.timedExamQuestions, total) : null;
              const timedExam = timedQuestions ? `${timedQuestions} questions · ${Math.round((timedQuestions * secondsPerQuestion) / 60)} min` : `Your length · ${SECONDS_PER_QUESTION} sec per question`;
              return (
                <tr key={certification.id}>
                  <th scope="row"><span className="practice-cert"><span className="cert-symbol"><Icon size={17} /></span><span><strong>{certification.acronym}</strong><small>{certification.examCode}</small></span></span></th>
                  <td data-label="Question bank">{total} questions · {certification.domains.length} domains</td>
                  <td data-label="Timed exam">{timedExam}</td>
                  <td><Link className="button button-primary button-small" href={`/practice/${certification.slug}`}>Set up <ArrowRight size={15} /><span className="sr-only"> {certification.acronym} practice</span></Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="page-note">A free account is required to answer practice questions, so your results can be saved to your progress.</p>
    </main>
  );
}
