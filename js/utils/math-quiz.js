import { state } from '../state.js';
import { showToast } from './helpers.js';

// Math Game & Speed Quiz Generator
export function generateMathQuiz() {
  const types = ['add', 'sub', 'mul', 'equation'];
  const type = types[Math.floor(Math.random() * types.length)];
  let question = '';
  let answer = 0;

  if (type === 'add') {
    const a = Math.floor(Math.random() * 89) + 10;
    const b = Math.floor(Math.random() * 89) + 10;
    question = `${a} + ${b} = ?`;
    answer = a + b;
  } else if (type === 'sub') {
    const a = Math.floor(Math.random() * 90) + 10;
    const b = Math.floor(Math.random() * a) + 1;
    question = `${a} - ${b} = ?`;
    answer = a - b;
  } else if (type === 'mul') {
    const a = Math.floor(Math.random() * 12) + 2;
    const b = Math.floor(Math.random() * 12) + 2;
    question = `${a} × ${b} = ?`;
    answer = a * b;
  } else if (type === 'equation') {
    const x = Math.floor(Math.random() * 15) + 1;
    const coeff = Math.floor(Math.random() * 5) + 2;
    const constNum = Math.floor(Math.random() * 20) + 1;
    const total = coeff * x + constNum;
    question = `${coeff}x + ${constNum} = ${total} (x=?)`;
    answer = x;
  }

  state.activeMathQuizAnswer = answer;
  return { question, answer };
}

export function checkMathQuizAnswer(inputAns) {
  if (state.activeMathQuizAnswer === null) return false;
  const num = parseInt(inputAns.trim(), 10);
  if (isNaN(num)) return false;

  if (num === state.activeMathQuizAnswer) {
    state.activeMathQuizAnswer = null;
    showToast('正解です！ 算数ポイント+20pt 獲得！', 'success');
    return true;
  }
  return false;
}
