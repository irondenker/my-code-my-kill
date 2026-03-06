import type { Request } from 'express';
import { normalizeString } from '../string.util.js';
import { generateSimpleCaptchaChallenge } from './simple-captcha.util.js';

function ensureLoginCaptchaChallenge(req: Request): string {
  const existingQuestion = normalizeString(req.session.loginCaptchaQuestion, '');
  const existingAnswer = normalizeString(req.session.loginCaptchaAnswer, '');
  if (existingQuestion.length > 0 && existingAnswer.length > 0) {
    return existingQuestion;
  }

  const challenge = generateSimpleCaptchaChallenge();
  req.session.loginCaptchaQuestion = challenge.question;
  req.session.loginCaptchaAnswer = challenge.answer;
  return challenge.question;
}

export function resolveLoginCaptchaViewModel(
  req: Request,
  enabled: boolean
): {
  required: boolean;
  question: string | null;
} {
  if (!enabled || req.session.loginCaptchaRequired !== true) {
    return {
      required: false,
      question: null,
    };
  }

  return {
    required: true,
    question: ensureLoginCaptchaChallenge(req),
  };
}

export function recordLoginFailureForCaptcha(
  req: Request,
  params: {
    enabled: boolean;
    afterFailures: number;
  }
) {
  if (!params.enabled) {
    return;
  }

  const threshold = Math.max(1, Math.trunc(params.afterFailures));
  const currentCount = Number.isInteger(req.session.loginCaptchaFailureCount)
    ? Number(req.session.loginCaptchaFailureCount)
    : 0;
  const nextCount = currentCount + 1;
  req.session.loginCaptchaFailureCount = nextCount;

  if (nextCount >= threshold) {
    req.session.loginCaptchaRequired = true;
    ensureLoginCaptchaChallenge(req);
  }
}

export function verifyLoginCaptchaAnswer(req: Request, answerInput: unknown): boolean {
  if (req.session.loginCaptchaRequired !== true) {
    return true;
  }

  const expectedAnswer = normalizeString(req.session.loginCaptchaAnswer, '');
  const submittedAnswer = normalizeString(answerInput, '');
  if (expectedAnswer.length > 0 && submittedAnswer === expectedAnswer) {
    delete req.session.loginCaptchaQuestion;
    delete req.session.loginCaptchaAnswer;
    return true;
  }

  const challenge = generateSimpleCaptchaChallenge();
  req.session.loginCaptchaQuestion = challenge.question;
  req.session.loginCaptchaAnswer = challenge.answer;
  return false;
}

export function clearLoginCaptchaState(req: Request) {
  delete req.session.loginCaptchaFailureCount;
  delete req.session.loginCaptchaRequired;
  delete req.session.loginCaptchaQuestion;
  delete req.session.loginCaptchaAnswer;
}
