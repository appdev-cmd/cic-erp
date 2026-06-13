import '../setup-env.ts';

async function main() {
  const url = 'https://news.google.com/rss/articles/CBMibEFVX3lxTE13a1dhTFZuRWd5ZDlvRkVJUGJING1CMEpUYzBMeUNxZ2NLQ01JM2Z3WTd5R2FBNGd6SjJ1b3BlRXVtR29iYmhSNXMtSGNwdE9OTE9XZkkxMHBtaHprb3ZtTUgxYmpGV0hTWWFLXw?oc=5';
  console.log('Fetching without headers...');
  try {
    const res = await fetch(url);
    console.log('Status:', res.status);
    console.log('Final URL:', res.url);
    console.log('Redirected:', res.redirected);
  } catch (e) {
    console.error(e);
  }
}

main();
