import '../setup-env.ts';

async function main() {
  const url = 'https://news.google.com/articles/CBMibEFVX3lxTE13a1dhTFZuRWd5ZDlvRkVJUGJING1CMEpUYzBMeUNxZ2NLQ01JM2Z3WTd5R2FBNGd6SjJ1b3BlRXVtR29iYmhSNXMtSGNwdE9OTE9XZkkxMHBtaHprb3ZtTUgxYmpGV0hTWWFLXw?oc=5';
  console.log('Fetching articles URL without /rss...');
  try {
    const res = await fetch(url, {
      redirect: 'manual'
    });
    console.log('Status:', res.status);
    console.log('Location:', res.headers.get('location'));
    console.log('All Headers:');
    res.headers.forEach((val, key) => console.log(`- ${key}: ${val}`));
  } catch (e) {
    console.error(e);
  }
}

main();
