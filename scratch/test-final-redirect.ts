import '../setup-env.ts';

async function main() {
  const url = 'https://news.google.com/articles/CBMibEFVX3lxTE13a1dhTFZuRWd5ZDlvRkVJUGJING1CMEpUYzBMeUNxZ2NLQ01JM2Z3WTd5R2FBNGd6SjJ1b3BlRXVtR29iYmhSNXMtSGNwdE9OTE9XZkkxMHBtaHprb3ZtTUgxYmpGV0hTWWFLXw?oc=5&hl=en-US&gl=US&ceid=US:en';
  console.log('Fetching language-redirected URL...');
  try {
    const res = await fetch(url, {
      redirect: 'manual'
    });
    console.log('Status:', res.status);
    console.log('Location:', res.headers.get('location'));
  } catch (e) {
    console.error(e);
  }
}

main();
