export function sandboxKey(baseline,override='') {
 const key=override||baseline.STRIPE_SECRET_KEY||'';
 if(key&&!/^(sk|rk)_test_/.test(key))throw new Error('Workspace/local/staging Stripe configuration must use a sandbox key');
 return key;
}
