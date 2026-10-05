"use client";

import { create } from "zustand";

export type QuizMode = "PRACTICE" | "TIMED" | "CUSTOM";

export type QuizQuestion = {
  id: string;
  prompt: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  imageUrl: string | null;
  domain: { id: string; name: string; objective: string };
  options: { label: string; text: string }[];
};

export type AnswerState = {
  questionId: string;
  selectedLabel: string;
  isCorrect?: boolean;
  correctLabel?: string;
  correctText?: string;
  explanation?: string;
};

type QuizSession = { id: string; startedAt: string; completedAt?: string | null };
type CertificationInfo = { name: string; examCode: string; slug: string };

type QuizStore = {
  quiz: QuizSession | null;
  certification: CertificationInfo | null;
  mode: QuizMode;
  questions: QuizQuestion[];
  answers: Record<string, AnswerState>;
  setSession: (quiz: QuizSession, questions: QuizQuestion[], certification: CertificationInfo, mode: QuizMode, answers?: AnswerState[]) => void;
  setAnswer: (answer: AnswerState) => void;
  setCompleted: (completedAt: string) => void;
  clearSession: () => void;
};

export const useQuizStore = create<QuizStore>((set) => ({
  quiz: null,
  certification: null,
  mode: "PRACTICE",
  questions: [],
  answers: {},
  setSession: (quiz, questions, certification, mode, answers = []) => set({
    quiz, questions, certification, mode, answers: Object.fromEntries(answers.map((answer) => [answer.questionId, answer])),
  }),
  setAnswer: (answer) => set((state) => ({ answers: { ...state.answers, [answer.questionId]: answer } })),
  setCompleted: (completedAt) => set((state) => ({ quiz: state.quiz ? { ...state.quiz, completedAt } : null })),
  clearSession: () => set({ quiz: null, certification: null, questions: [], answers: {} }),
}));