"use client";

import { ProtectedAppShell } from "@/components/protected-app-shell";

const glossaryTerms = [
  { term: "Agenda", definition: "The topic or issue being discussed in a committee session." },
  { term: "Amendment", definition: "A change or addition proposed to a draft resolution." },
  { term: "Bloc", definition: "An informal alliance of delegates who share similar positions on an issue." },
  { term: "Chair", definition: "The person who presides over a committee session and enforces rules of procedure." },
  { term: "Caucus", definition: "A meeting of delegates to discuss and negotiate outside formal session." },
  { term: "Chatham House Rules", definition: "A rule where participants can share information freely but cannot attribute it to specific individuals." },
  { term: "Crisis Committee", definition: "A fast-paced committee simulating emergency situations requiring quick decisions." },
  { term: "Draft Resolution", definition: "The formal document containing proposed solutions to the agenda topic." },
  { term: "Dais", definition: "The raised platform where the chair and vice-chairs sit." },
  { term: "Delegate", definition: "A student representing a specific country in a committee." },
  { term: "Entourage", definition: "Advisors or support staff who assist a delegate during a conference." },
  { term: "Floor", definition: "The area where delegates sit; also refers to the right to speak." },
  { term: "General Assembly (GA)", definition: "The main deliberative body of the UN where all member states are represented." },
  { term: "General Speaker's List (GSL)", definition: "A list of delegates who wish to speak on the topic in formal debate." },
  { term: "Hook", definition: "An opening statement technique that grabs the audience's attention." },
  { term: "ICJ", definition: "International Court of Justice — the UN's principal judicial organ." },
  { term: "Inputs", definition: "Research materials, background guides, and preparation documents for a conference." },
  { term: "Moderated Caucus", definition: "A structured debate where the chair calls on delegates to speak for short intervals on a sub-topic." },
  { term: "Motion", definition: "A formal proposal to take an action (e.g., motion for unmoderated caucus)." },
  { term: "Non-Governmental Organization (NGO)", definition: "A private organization that operates independently of government, often focused on advocacy." },
  { term: "Operative Clause", definition: "The action-oriented section of a resolution that proposes specific measures." },
  { term: "Placard", definition: "A sign with a country's name placed on the delegate's desk." },
  { term: "Point of Order", definition: "A procedural objection raised when the chair violates rules of procedure." },
  { term: "Point of Personal Privilege", definition: "Raised when a delegate cannot hear, is being misrepresented, or has a personal concern." },
  { term: "Position Paper", definition: "A formal document outlining a country's stance on the agenda topic." },
  { term: "Preambulatory Clause", definition: "The context-setting section of a resolution that provides background." },
  { term: "Quorum", definition: "The minimum number of delegates required for a committee to conduct official business (typically one-third)." },
  { term: "Roll Call Vote", definition: "A formal vote where each delegate must publicly state their vote (yes/no/abstain)." },
  { term: "Rules of Procedure", definition: "The formal rules that govern how a committee operates and debates." },
  { term: "Resolution", definition: "A formal document adopted by a committee outlining positions and proposed actions." },
  { term: "Security Council (UNSC)", definition: "The UN body responsible for international peace and security, with 5 permanent veto-wielding members." },
  { term: "Signatory", definition: "A delegate who supports a draft resolution but is not a primary author/sponsor." },
  { term: "Speaker's List", definition: "The order in which delegates are called to speak during formal debate." },
  { term: "Sponsor", definition: "A delegate who helps write and officially supports a draft resolution." },
  { term: "Squash", definition: "Informal negotiation between two or more delegates during unmoderated caucus." },
  { term: "Topic", definition: "The specific issue or sub-issue being addressed in committee." },
  { term: "Unmoderated Caucus", definition: "A break from formal debate where delegates move freely to negotiate and form blocs." },
  { term: "Veto", definition: "The power of the 5 permanent UNSC members to block any substantive resolution." },
  { term: "Working Paper", definition: "An unofficial draft document submitted for discussion before it becomes a draft resolution." },
  { term: "Yields", definition: "When a speaker gives up remaining time — to questions, to the chair, or to another delegate." },
];

/** Glossary reference page listing essential MUN terms. */
export default function GlossaryPage() {
  return (
    <ProtectedAppShell>
      <div className="max-w-4xl mx-auto px-5 py-8">
        <header className="mb-8">
          <p className="label-text text-[var(--brass)]">Reference</p>
          <h1 className="display-type mt-2 text-4xl sm:text-5xl">Glossary</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)] max-w-2xl">
            Essential MUN terminology — from agenda to yield. Bookmark this for quick reference during conferences.
          </p>
        </header>

        <div className="space-y-2">
          {glossaryTerms.map((item) => (
            <div key={item.term} className="surface rounded-xl px-5 py-4">
              <dt className="font-semibold text-sm">{item.term}</dt>
              <dd className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.definition}</dd>
            </div>
          ))}
        </div>
      </div>
    </ProtectedAppShell>
  );
}
