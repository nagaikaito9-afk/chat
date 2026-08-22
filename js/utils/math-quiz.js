import { state } from '../state.js';
import { showToast } from './helpers.js';

export const MATH_LEVELS = {
  easy: { name: '簡単 (足し算・引き算)', badge: '🟢 簡単', pts: 20 },
  normal: { name: '普通 (掛け算・割り算)', badge: '🟡 普通', pts: 35 },
  hard: { name: '難しい (四則演算の組み合わせ)', badge: '🔴 難しい', pts: 50 },
  very_hard: { name: 'すごく難しい (xの方程式・√・階乗!・数列)', badge: '🟣 すごく難しい', pts: 80 },
  super_hard: { name: 'ものすごく難しい (連立方程式x,y・小数・分数・絶対値・超難問)', badge: '👑 ものすごく難しい', pts: 120 }
};

function factorial(n) {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

export function generateMathQuiz(levelKey = 'easy') {
  let question = '';
  let answer = '';
  let acceptedAnswers = [];

  switch (levelKey) {
    case 'easy': {
      const isAdd = Math.random() < 0.5;
      if (isAdd) {
        const a = Math.floor(Math.random() * 89) + 10;
        const b = Math.floor(Math.random() * 89) + 10;
        question = `${a} + ${b} = ?`;
        answer = (a + b).toString();
      } else {
        const a = Math.floor(Math.random() * 89) + 20;
        const b = Math.floor(Math.random() * (a - 5)) + 5;
        question = `${a} - ${b} = ?`;
        answer = (a - b).toString();
      }
      acceptedAnswers = [answer];
      break;
    }

    case 'normal': {
      const isMul = Math.random() < 0.5;
      if (isMul) {
        const a = Math.floor(Math.random() * 15) + 3;
        const b = Math.floor(Math.random() * 15) + 3;
        question = `${a} × ${b} = ?`;
        answer = (a * b).toString();
      } else {
        const ans = Math.floor(Math.random() * 15) + 2;
        const b = Math.floor(Math.random() * 12) + 3;
        const a = ans * b;
        question = `${a} ÷ ${b} = ?`;
        answer = ans.toString();
      }
      acceptedAnswers = [answer];
      break;
    }

    case 'hard': {
      const pattern = Math.floor(Math.random() * 3);
      if (pattern === 0) {
        const a = Math.floor(Math.random() * 20) + 5;
        const b = Math.floor(Math.random() * 20) + 5;
        const c = Math.floor(Math.random() * 8) + 2;
        const divAns = Math.floor(Math.random() * 10) + 2;
        const e = Math.floor(Math.random() * 8) + 2;
        const d = divAns * e;
        const ansVal = (a + b) * c - divAns;
        question = `(${a} + ${b}) × ${c} - ${d} ÷ ${e} = ?`;
        answer = ansVal.toString();
      } else if (pattern === 1) {
        const b = Math.floor(Math.random() * 10) + 2;
        const c = Math.floor(Math.random() * 8) + 2;
        const bc = b * c;
        const a = bc + Math.floor(Math.random() * 50) + 10;
        const divAns = Math.floor(Math.random() * 10) + 2;
        const e = Math.floor(Math.random() * 8) + 2;
        const d = divAns * e;
        const ansVal = a - bc + divAns;
        question = `${a} - (${b} × ${c}) + ${d} ÷ ${e} = ?`;
        answer = ansVal.toString();
      } else {
        const divAns = Math.floor(Math.random() * 10) + 2;
        const c = Math.floor(Math.random() * 8) + 2;
        const diff = divAns * c;
        const b = Math.floor(Math.random() * 30) + 5;
        const a = b + diff;
        const d = Math.floor(Math.random() * 9) + 2;
        const e = Math.floor(Math.random() * 9) + 2;
        const ansVal = divAns + (d * e);
        question = `(${a} - ${b}) ÷ ${c} + ${d} × ${e} = ?`;
        answer = ansVal.toString();
      }
      acceptedAnswers = [answer];
      break;
    }

    case 'very_hard': {
      const type = Math.floor(Math.random() * 4);
      if (type === 0) {
        const x = Math.floor(Math.random() * 25) + 2;
        const coeff = Math.floor(Math.random() * 6) + 2;
        const constNum = Math.floor(Math.random() * 40) + 5;
        const total = coeff * x - constNum;
        question = `${coeff}x - ${constNum} = ${total} (x=?)`;
        answer = x.toString();
      } else if (type === 1) {
        const rVal = Math.floor(Math.random() * 10) + 5;
        const sq = rVal * rVal;
        const fVal = Math.floor(Math.random() * 3) + 4;
        const fact = factorial(fVal);
        const ansVal = rVal + fact;
        question = `√${sq} + ${fVal}! = ?`;
        answer = ansVal.toString();
      } else if (type === 2) {
        const r1 = Math.floor(Math.random() * 8) + 4;
        const r2 = Math.floor(Math.random() * 8) + 3;
        const sq1 = r1 * r1;
        const sq2 = r2 * r2;
        const mult = Math.floor(Math.random() * 5) + 2;
        const ansVal = (r1 * mult) + r2;
        question = `√${sq1} × ${mult} + √${sq2} = ?`;
        answer = ansVal.toString();
      } else {
        const seqType = Math.floor(Math.random() * 3);
        if (seqType === 0) {
          question = `数列: 1, 4, 9, 16, 25, ? (次項は?)`;
          answer = '36';
        } else if (seqType === 1) {
          question = `数列: 2, 5, 10, 17, 26, ? (次項は?)`;
          answer = '37';
        } else {
          question = `数列: 3, 6, 12, 24, 48, ? (次項は?)`;
          answer = '96';
        }
      }
      acceptedAnswers = [answer];
      break;
    }

    case 'super_hard': {
      const type = Math.floor(Math.random() * 4);
      if (type === 0) {
        const x = Math.floor(Math.random() * 8) + 2;
        const y = Math.floor(Math.random() * 8) + 2;
        const eq1 = `x + y = ${x + y}`;
        const eq2 = `2x - y = ${2 * x - y}`;
        const ansVal = x * y;
        question = `連立方程式: [ ${eq1}, ${eq2} ] のとき x × y の値は?`;
        answer = ansVal.toString();
        acceptedAnswers = [answer, `x=${x},y=${y}`, `x=${x} y=${y}`];
      } else if (type === 1) {
        const absVal = Math.floor(Math.random() * 20) + 10;
        const decMultiplier = Math.floor(Math.random() * 8) + 2;
        const decVal = 2.5;
        const fracNumerator = 5;
        const fracDenominator = 2;
        const ansVal = absVal + (decVal * decMultiplier) - (fracNumerator / fracDenominator);
        question = `| -${absVal} | + 2.5 × ${decMultiplier} - ${fracNumerator}/${fracDenominator} = ?`;
        answer = ansVal.toString();
        acceptedAnswers = [answer, `${ansVal}`];
      } else if (type === 2) {
        const subType = Math.random() < 0.5;
        if (subType) {
          const ansVal = 10 + 15;
          question = `高校数学: ₅C₂ + ₆C₂ = ?`;
          answer = '25';
        } else {
          question = `高校数学: ₆P₃ + | -15 | = ?`;
          answer = '135';
        }
        acceptedAnswers = [answer];
      } else {
        const a = Math.floor(Math.random() * 4) + 2;
        const ansVal = (0.5 * 40) + (0.5 * 20) + a;
        question = `三角関数: sin(30°) × 40 + cos(60°) × 20 + ${a} = ?`;
        answer = ansVal.toString();
        acceptedAnswers = [answer];
      }
      break;
    }
  }

  const levelData = MATH_LEVELS[levelKey] || MATH_LEVELS.easy;

  state.activeMathQuiz = {
    levelKey,
    levelName: levelData.name,
    badge: levelData.badge,
    pts: levelData.pts,
    question,
    answer,
    acceptedAnswers
  };

  return state.activeMathQuiz;
}

export function checkMathQuizAnswer(inputAns) {
  if (!state.activeMathQuiz || !state.activeMathQuiz.answer) return null;

  const trimmedInput = inputAns.trim().toLowerCase();
  const activeQuiz = state.activeMathQuiz;

  const isMatch = activeQuiz.acceptedAnswers.some(ans => {
    return ans.toLowerCase() === trimmedInput || ans.toLowerCase() === trimmedInput.replace(/\s+/g, '');
  });

  if (isMatch) {
    const quizInfo = { ...activeQuiz };
    state.activeMathQuiz = null;
    return quizInfo;
  }
  return null;
}

