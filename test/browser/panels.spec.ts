import {test,expect} from '@playwright/test';
const id='00000000-0000-4000-8000-000000000011';
async function setup(page:import('@playwright/test').Page,role:string|null='admin',signedIn=true){
 if(signedIn)await page.addInitScript(()=>{const user={id:'00000000-0000-4000-8000-000000000001',email:'buyer@example.com',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'}))+'.test';localStorage.setItem('sb-example-auth-token',JSON.stringify({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));});
 await page.route('https://example.supabase.co/**',r=>r.fulfill({json:{}}));
 await page.route('https://www.youtube.com/**',r=>r.fulfill({body:'Event video'}));
 await page.route('**/api/**',r=>{
 const p=new URL(r.request().url()).pathname;
 const ticket={id,type:'startup',label:'Startup',status:'active',attendee:{full_name:'Test holder',email:'buyer@example.com'},used:true,transferable:false,transfer:null};
 const data=p==='/api/me'?{email:'buyer@example.com',staffRole:role,canAccessTickets:true,canAccessOrders:true,orders:[]}:p==='/api/me/tickets'?{tickets:[ticket]}:p==='/api/ticket-types'?{salesEnabled:true,types:[{code:'startup',label:'Startup',amount:3000,currency:'JPY'}],currencies:[{code:'JPY',decimals:0}],sectors:[]}:p==='/api/admin/tickets'?{tickets:[{...ticket,code:'startup',full_name:'Test holder',email:'buyer@example.com',payment_status:'paid',created_at:new Date().toISOString()}],hasMore:false}:p===`/api/admin/tickets/${id}`?{...ticket,code:'startup',full_name:'Test holder',email:'buyer@example.com',payment_status:'paid',checkins:[]}:p.endsWith('/qr')?{credential:'test-credential'}:p==='/api/admin/discounts'?{discounts:[]}:p==='/api/admin/ticket-types'?{ticketTypes:[],salesEnabled:false}:{};
 return r.fulfill({json:data});
 });
}
test('account detail refresh preserves second-day QR access',async({page})=>{await setup(page);await page.goto(`/account/tickets/${id}`);await expect(page.getByRole('button',{name:'Show QR'})).toBeEnabled();await expect(page.getByRole('button',{name:'Attendee details'})).toBeDisabled();await page.reload();await expect(page.getByRole('button',{name:'Show QR'})).toBeEnabled();});
test('global admin search and dedicated details',async({page})=>{await setup(page);await page.goto('/admin/registrations');await expect(page.getByRole('cell',{name:'Test holder',exact:true})).toBeVisible();await page.getByRole('textbox',{name:'Search all registrations'}).fill('buyer@example.com');await page.getByRole('button',{name:'Apply filters'}).click();await expect(page).toHaveURL(/q=buyer/);await page.getByRole('link',{name:'View',exact:true}).click();await expect(page.getByRole('button',{name:'Revoke ticket',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'Revoke ticket',exact:true})).toBeVisible();});
test('ordinary user cannot open admin data',async({page})=>{await setup(page,null);await page.goto('/admin/registrations');await expect(page.getByRole('alert')).toContainText('permission');});
test('mobile account fits without a Buy tickets button',async({page})=>{await page.setViewportSize({width:320,height:800});await setup(page);await page.goto('/account/tickets');await expect(page.getByRole('link',{name:'View ticket'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await expect(page.getByRole('button',{name:'Buy tickets',exact:true})).toHaveCount(0);});
for(const width of [320,768,1024,1440])test(`admin layout fits ${width}px`,async({page})=>{await page.setViewportSize({width,height:900});await setup(page);await page.goto('/admin/registrations');await expect(page.getByRole('link',{name:'View',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();});
test('check-in role lands on scanner and legacy tickets link redirects',async({page})=>{await setup(page,'checkin');await page.goto('/admin');await expect(page).toHaveURL(/\/admin\/check-in$/);await expect(page.getByRole('button',{name:'Scan next ticket'})).toBeVisible();await page.goto('/?tickets=1');await expect(page).toHaveURL(/\/account\/tickets$/);});
test('revocation dialog supports escape and restores focus',async({page})=>{await setup(page);await page.goto(`/admin/registrations/${id}`);const trigger=page.getByRole('button',{name:'Revoke ticket',exact:true});await trigger.click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeHidden();await expect(trigger).toBeFocused();});

test('Ticket cards open checkout without requesting OTP',async({page})=>{
 await setup(page,null,false);
 const authRequests:string[]=[];page.on('request',request=>{if(request.url().includes('supabase.co/auth/'))authRequests.push(request.url());});
 await page.route('**/api/create-checkout',async route=>{
  const data=route.request().postDataJSON();expect(data.name).toBe('Guest buyer');expect(data.email).toBe('guest@example.com');expect(data.qty.startup).toBe(2);expect(data.requestKey).toMatch(/^[\da-f-]{36}$/);
  expect(route.request().headers().authorization).toBeUndefined();
  await route.fulfill({json:{url:'https://checkout.stripe.test/session'}});
 });
 await page.route('https://checkout.stripe.test/**',route=>route.fulfill({body:'Secure checkout'}));
 await page.goto('/');await page.getByRole('button',{name:'Get startup ticket',exact:true}).click();
 const modal=page.getByRole('dialog');await expect(modal.getByRole('button',{name:'Continue',exact:true})).toBeVisible();
 await expect(modal.getByRole('button',{name:'Email me a code'})).toHaveCount(0);
 await modal.getByRole('spinbutton',{name:'Startup quantity'}).fill('2');await modal.getByRole('button',{name:'Continue',exact:true}).click();
 await modal.getByLabel('Buyer’s full name').fill('Guest buyer');await modal.getByLabel('Buyer’s email').fill('guest@example.com');
 await modal.getByRole('button',{name:'Continue to secure payment'}).click();await expect(page).toHaveURL('https://checkout.stripe.test/session');
 expect(authRequests).toEqual([]);
});

test('My tickets requires OTP after checkout and on direct access',async({page})=>{
 await setup(page,null,false);
 for(const path of ['/account/tickets',`/account/tickets?order=${id}`]){
  await page.goto(path);await expect(page.getByRole('button',{name:'Email me a code'})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'One-time code',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Show QR'})).toHaveCount(0);
 }
 await expect(page.getByRole('textbox',{name:'Email',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Buy tickets',exact:true})).toHaveCount(0);
});

test('canceled payment restores registration without OTP',async({page})=>{
 await setup(page,null,false);
 await page.addInitScript(()=>sessionStorage.setItem('takeoff-checkout-request',JSON.stringify({key:'00000000-0000-4000-8000-000000000099',selection:JSON.stringify({name:'Guest buyer',email:'guest@example.com',qty:{startup:2},discountCode:''})})));
 await page.goto('/?checkout=canceled');const modal=page.getByRole('dialog');await expect(modal).toBeVisible();
 await expect(modal.getByLabel('Buyer’s full name')).toHaveValue('Guest buyer');await expect(modal.getByLabel('Buyer’s email')).toHaveValue('guest@example.com');await expect(modal.getByRole('region',{name:'Selected tickets'})).toContainText('Startup × 2');
 await expect(modal.getByRole('button',{name:'Email me a code'})).toHaveCount(0);await expect(modal.getByRole('status')).toContainText('canceled');
});

test('tickets refresh when a delayed payment is confirmed after sign-in',async({page})=>{
 await setup(page,null);let polls=0;
 await page.route(`**/api/orders/${id}`,route=>route.fulfill({json:{id,status:++polls===1?'pending':'paid',total_amount:3000,items:[],tickets:[]}}));
 await page.goto(`/account/tickets?order=${id}`);
 await expect(page.getByRole('status')).toContainText('Awaiting payment confirmation');
 await expect(page.getByRole('status')).toHaveCount(0,{timeout:10000});expect(polls).toBe(2);
});

test('unrecognized ticket emails do not reach OTP entry or the dashboard',async({page})=>{
 await setup(page,null,false);const authRequests:string[]=[];
 page.on('request',request=>{if(request.url().includes('/auth/v1/'))authRequests.push(request.url());});
 await page.route('**/api/auth/request-code',route=>{
  expect(route.request().postDataJSON()).toEqual({email:'unknown@example.com',purpose:'tickets'});
  return route.fulfill({status:403,json:{error:'No tickets are associated with this email.'}});
 });
 await page.goto('/account/tickets');await page.getByRole('textbox',{name:'Email',exact:true}).fill('unknown@example.com');
 await page.getByRole('button',{name:'Email me a code'}).click();await expect(page.getByRole('alert')).toContainText('No tickets');
 await expect(page.getByRole('textbox',{name:'One-time code',exact:true})).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Account navigation'})).toHaveCount(0);expect(authRequests).toEqual([]);
});

test('eligible ticket emails reach OTP entry through the checked server route',async({page})=>{
 await setup(page,null,false);let requests=0;
 await page.route('**/api/auth/request-code',route=>{requests++;expect(route.request().postDataJSON().purpose).toBe('tickets');return route.fulfill({json:{sent:true}});});
 await page.goto('/account/tickets');await page.getByRole('textbox',{name:'Email',exact:true}).fill('holder@example.com');await page.getByRole('button',{name:'Email me a code'}).click();
 await expect(page.getByRole('textbox',{name:'One-time code',exact:true})).toBeVisible();expect(requests).toBe(1);
 await expect(page.getByRole('navigation',{name:'Account navigation'})).toHaveCount(0);
});

test('transferred-ticket holders cannot see Orders or open its routes',async({page})=>{
 await setup(page,null);
 await page.route('**/api/me',route=>route.fulfill({json:{email:'holder@example.com',staffRole:null,canAccessTickets:true,canAccessOrders:false,orders:[]}}));
 const orderRequests:string[]=[];page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/orders/'))orderRequests.push(request.url());});
 await page.goto('/account/tickets');await expect(page.getByRole('link',{name:'View ticket'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Orders',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Buy tickets',exact:true})).toHaveCount(0);
 await page.goto(`/account/orders/${id}`);await expect(page).toHaveURL(/\/account\/tickets$/);
 await expect(page.getByText('Your purchases',{exact:true})).toHaveCount(0);expect(orderRequests).toEqual([]);
});

test('original buyers retain the Orders tab and purchase history',async({page})=>{
 await setup(page,null);await page.goto('/account/tickets');await page.getByRole('link',{name:'Orders',exact:true}).click();
 await expect(page).toHaveURL(/\/account\/orders$/);await expect(page.getByRole('heading',{name:'Orders',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Buy tickets',exact:true})).toHaveCount(0);
});

test('an existing session without ticket access cannot enter the dashboard',async({page})=>{
 await setup(page,null);await page.route('**/api/me',route=>route.fulfill({status:403,json:{error:'No tickets or purchases are associated with this account'}}));
 await page.goto('/account/tickets');await expect(page.getByRole('alert')).toContainText('No tickets');
 await expect(page.getByRole('navigation',{name:'Account navigation'})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'View ticket'})).toHaveCount(0);
});

test('admin creates public types, manages JPY prices and cannot delete purchased types',async({page})=>{
 await setup(page);
 const types=[{id,code:'startup',label:'Startup',public_purchase:true,deleted_at:null,ever_purchased:true,purchase_count:1,prices:[{id:'old',amount:3000,currency:'JPY',active:true,created_at:new Date().toISOString()}]}];let salesEnabled=true;
 await page.route('**/api/admin/ticket-types**',async route=>{
  const path=new URL(route.request().url()).pathname;const method=route.request().method();const input=method==='GET'?null:route.request().postDataJSON();
  if(method==='POST'&&path==='/api/admin/ticket-types'){types.push({id:'00000000-0000-4000-8000-000000000099',code:input.code,label:input.label,public_purchase:false,deleted_at:null,ever_purchased:false,purchase_count:0,prices:[]});return route.fulfill({json:types.at(-1)});}
  const ticket=types.at(-1)!;
  if(method==='POST'&&path.endsWith('/prices')){expect(input.amount).toBe(4500);ticket.prices.push({id:'new',amount:input.amount,currency:'JPY',active:true,created_at:new Date().toISOString()});}
  if(method==='PATCH'){ticket.label=input.label;ticket.public_purchase=input.publicPurchase;}
  return route.fulfill({json:method==='GET'?{ticketTypes:types,salesEnabled}:{saved:true}});
 });
 await page.route('**/api/admin/ticket-sales',async route=>{salesEnabled=route.request().postDataJSON().enabled;return route.fulfill({json:{saved:true}});});
 await page.goto('/admin/ticket-types');await expect(page.getByRole('button',{name:'Delete Startup',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Create ticket type',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Ticket code').fill('general');await dialog.getByLabel('Ticket name').fill('General admission');await dialog.getByRole('button',{name:'Create type',exact:true}).click();await expect(dialog).toBeHidden();
 await page.getByRole('button',{name:'Set price',exact:true}).click();await dialog.getByRole('spinbutton',{name:'Price (JPY)',exact:true}).fill('4500');await dialog.getByRole('button',{name:'Save changes'}).click();await expect(dialog).toBeHidden();
 await page.getByRole('button',{name:'Edit General admission',exact:true}).click();await dialog.getByLabel('Available for public purchase').check();await dialog.getByRole('button',{name:'Save changes'}).click();await expect(dialog).toBeHidden();
 await expect(page.getByText('¥4,500', {exact:false}).first()).toBeVisible();await page.getByRole('button',{name:'Close sales',exact:true}).click();await expect(page.getByRole('button',{name:'Open sales',exact:true})).toBeVisible();
 await page.setViewportSize({width:320,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('canceled checkout restores additional public ticket types',async({page})=>{
 await setup(page,null,false);
 await page.route('**/api/ticket-types',route=>route.fulfill({json:{salesEnabled:true,types:[{code:'general',label:'General admission',amount:4500,currency:'JPY'}],currencies:[],sectors:[]}}));
 await page.addInitScript(()=>sessionStorage.setItem('takeoff-checkout-request',JSON.stringify({key:'00000000-0000-4000-8000-000000000099',selection:JSON.stringify({name:'Guest buyer',email:'guest@example.com',qty:{general:2},discountCode:''})})));
 await page.goto('/?checkout=canceled');const modal=page.getByRole('dialog');await expect(modal.getByRole('region',{name:'Selected tickets'})).toContainText('General admission × 2');await expect(modal.getByLabel('Buyer’s email')).toHaveValue('guest@example.com');
});
test('discount eligibility includes additional public ticket types',async({page})=>{
 await setup(page);
 await page.route('**/api/admin/ticket-types',route=>route.fulfill({json:{ticketTypes:[{id,code:'general',label:'General admission',deleted_at:null},{id:'crew',code:'crew',label:'Crew',deleted_at:null}]}}));
 await page.goto('/admin/discounts');await page.getByRole('button',{name:'Create discount',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('checkbox',{name:'General admission',exact:true})).toBeVisible();await expect(dialog.getByRole('checkbox',{name:'Crew',exact:true})).toHaveCount(0);
});

test('QR image contains a decodable signed credential',async({page})=>{
 const {signCredential,verifyCredential,sha256}=await import('../../functions/lib/core.js');
 const signing={QR_SIGNING_SECRET:'browser-qr-test-secret-'.repeat(3)};
 const credential=await signCredential(signing,id);
 await setup(page,null);
 await page.route(`**/api/tickets/${id}/qr`,route=>route.fulfill({json:{credential}}));
 await page.goto(`/account/tickets/${id}`);await page.getByRole('button',{name:'Show QR',exact:true}).click();
 const image=page.getByRole('img',{name:'Admission QR for Test holder',exact:true});await expect(image).toBeVisible();
 await expect.poll(()=>image.evaluate((node:HTMLImageElement)=>node.naturalWidth)).toBeGreaterThan(0);
 const source=await image.getAttribute('src');expect(source).toMatch(/^data:image\/png;base64,/);
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
 const {PNG}=require('pngjs');const {RGBLuminanceSource,HybridBinarizer,BinaryBitmap,QRCodeReader}=require('@zxing/library');
 const png=PNG.sync.read(Buffer.from(source!.split(',')[1],'base64'));
 const luminance=new Uint8ClampedArray(png.width*png.height);
 for(let i=0;i<luminance.length;i++)luminance[i]=(png.data[i*4]+2*png.data[i*4+1]+png.data[i*4+2])/4;
 const decoded=new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance,png.width,png.height)))).getText();
 expect(decoded).toBe(credential);expect(await verifyCredential(signing,decoded)).toBe(await sha256(id));
});

test('QR stays disabled until attendee details are saved',async({page})=>{
 await setup(page,null);
 await page.route('**/api/me/tickets',route=>route.fulfill({json:{tickets:[{id,type:'startup',label:'Startup',status:'active',attendee:null,used:false,transferable:true,transfer:null}]}}));
 await page.goto(`/account/tickets/${id}`);await expect(page.getByRole('button',{name:'Show QR',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Attendee details',exact:true})).toBeEnabled();
});

test('collapsed optional questionnaire preserves saved answers',async({page})=>{
 await setup(page,null);let saved=false;
 await page.route('**/api/me/tickets',route=>route.fulfill({json:{tickets:[{id,type:'startup',label:'Startup',status:'active',attendee:{full_name:'Test holder',email:'buyer@example.com'},startup:{business_description:'Existing answer',funding_amount:12000,funding_currency:'JPY',funding_stage:'seed',target_vc_types:'Early stage'},used:false,transferable:true,transfer:null}]}}));
 await page.route(`**/api/tickets/${id}/attendee`,route=>{const data=route.request().postDataJSON();expect(data.profile.business_description).toBe('Existing answer');expect(data.profile.funding_amount).toBe(12000);expect(data.profile.funding_stage).toBe('seed');saved=true;return route.fulfill({json:{saved:true}});});
 await page.goto(`/account/tickets/${id}/edit`);await expect(page.getByLabel('What does your business do?')).toBeHidden();await page.getByRole('button',{name:'Save details',exact:true}).click();await expect(page).toHaveURL(`/account/tickets/${id}`);expect(saved).toBe(true);
});

test('compact mobile checkout keeps discounts and payment usable',async({page})=>{
 await page.setViewportSize({width:320,height:568});await setup(page,null,false);
 await page.route('**/api/discounts/quote',route=>route.fulfill({json:{code:'LAUNCH20',percentage:20,subtotal:3000,discountAmount:600,total:2400}}));
 await page.goto('/');await page.getByRole('button',{name:'Get startup ticket',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByRole('spinbutton',{name:'Startup quantity'}).fill('1');await dialog.getByRole('button',{name:'Continue',exact:true}).click();await dialog.getByLabel('Buyer’s full name').fill('Guest');await page.keyboard.press('Tab');await expect(dialog.getByLabel('Buyer’s email')).toBeFocused();await dialog.getByLabel('Buyer’s email').fill('guest@example.com');
 expect(await dialog.getByLabel('Buyer’s email').evaluate(input=>input.getBoundingClientRect().bottom<=input.closest('.checkout-form')!.querySelector('.checkout-footer')!.getBoundingClientRect().top)).toBe(true);
 await dialog.locator('summary').filter({hasText:'Discount code'}).click();await dialog.getByLabel('Discount code',{exact:true}).fill('LAUNCH20');await dialog.getByRole('button',{name:'Apply code',exact:true}).click();
 await expect(dialog.locator('.checkout-footer')).toContainText('¥2,400');const payment=dialog.getByRole('button',{name:'Continue to secure payment'});await expect(payment).toBeEnabled();await expect(payment).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const terminal of ['expired','failed'])test(`${terminal} payment can restart without losing its selection`,async({page})=>{
 await setup(page,null,false);const oldKey='00000000-0000-4000-8000-000000000099';const requests:Record<string,unknown>[]=[];
 await page.addInitScript(({oldKey})=>sessionStorage.setItem('takeoff-checkout-request',JSON.stringify({key:oldKey,selection:JSON.stringify({name:'Guest buyer',email:'guest@example.com',qty:{startup:2},discountCode:''})})),{oldKey});
 await page.route('**/api/create-checkout',async route=>{const data=route.request().postDataJSON();requests.push(data);if(data.requestKey===oldKey)return route.fulfill({status:409,json:{error:'This payment attempt ended. Restart payment to try again.',code:'checkout_restart_required'}});return route.fulfill({json:{url:'https://checkout.stripe.test/restarted'}});});
 await page.route('https://checkout.stripe.test/**',route=>route.fulfill({body:'Secure checkout'}));
 await page.goto('/?checkout=canceled');const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Restart payment'})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Continue to secure payment'}).click();await expect(dialog.getByRole('button',{name:'Restart payment'})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('takeoff-checkout-request')!).key)).toBe(oldKey);
 await dialog.getByRole('button',{name:'Restart payment'}).click();await expect(page).toHaveURL('https://checkout.stripe.test/restarted');
 expect(requests).toHaveLength(2);expect(requests[1].requestKey).not.toBe(oldKey);expect(requests[1]).toEqual({...requests[0],requestKey:requests[1].requestKey});
});

test('pending checkout errors retain the request key across retries and reloads',async({page})=>{
 await setup(page,null,false);const keys:string[]=[];
 await page.route('**/api/create-checkout',async route=>{keys.push(route.request().postDataJSON().requestKey);return route.fulfill({status:503,json:{error:'Please try again'}});});
 await page.goto('/');await page.getByRole('button',{name:'Get startup ticket',exact:true}).click();let dialog=page.getByRole('dialog');
 await dialog.getByRole('spinbutton',{name:'Startup quantity'}).fill('1');await dialog.getByRole('button',{name:'Continue',exact:true}).click();await dialog.getByLabel('Buyer’s full name').fill('Guest');await dialog.getByLabel('Buyer’s email').fill('guest@example.com');
 await dialog.getByRole('button',{name:'Continue to secure payment'}).click();await expect(dialog.getByRole('alert')).toContainText('Please try again');await expect(dialog.getByRole('button',{name:'Restart payment'})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Continue to secure payment'}).click();await expect.poll(()=>keys.length).toBe(2);
 await page.reload();await page.getByRole('button',{name:'Get startup ticket',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Continue',exact:true}).click();await dialog.getByRole('button',{name:'Continue to secure payment'}).click();await expect.poll(()=>keys.length).toBe(3);
 expect(new Set(keys).size).toBe(1);
});

for(const account of ['holder','staff','new'])test(`first ${account} purchase refreshes access after the webhook`,async({page})=>{
 await setup(page,account==='staff'?'admin':null);let profiles=0,paid=false,orderReads=0;
 const newTicket='00000000-0000-4000-8000-000000000022';
 await page.route('**/api/me',route=>{
  paid=++profiles>=4;
  if(account==='new'&&!paid)return route.fulfill({status:403,json:{error:'No tickets or purchases are associated with this account'}});
  return route.fulfill({json:{email:'buyer@example.com',staffRole:account==='staff'?'admin':null,canAccessTickets:account==='holder'||paid,canAccessOrders:paid,orders:[]}});
 });
 await page.route('**/api/me/tickets',route=>route.fulfill({json:{tickets:[...(account==='holder'?[{id}]:[]),...(paid?[{id:newTicket}]:[])].map(t=>({...t,type:'startup',label:'Startup',status:'active',attendee:null,used:false,transferable:true,transfer:null}))}}));
 await page.route(`**/api/orders/${id}`,route=>{expect(paid).toBe(true);orderReads++;return route.fulfill({json:{id,status:'paid',total_amount:3000,items:[],tickets:[]}});});
 await page.goto(`/account/tickets?order=${id}`);await expect(page.getByRole('status')).toContainText('Awaiting payment confirmation');expect(orderReads).toBe(0);
 await expect(page.getByRole('link',{name:'View ticket',exact:true})).toHaveCount(account==='holder'?2:1,{timeout:12000});await expect(page.getByRole('link',{name:'Orders',exact:true})).toBeVisible();await expect(page.getByRole('status')).toHaveCount(0);expect(orderReads).toBeGreaterThan(0);
});

for(const choice of ['Orders','My tickets'])test(`accepted-transfer account link allows ${choice} sign-in`,async({page})=>{
 await setup(page,null,false);let purpose='';
 await page.route('**/api/auth/request-code',route=>{purpose=route.request().postDataJSON().purpose;return route.fulfill({json:{sent:true}});});
 await page.goto('/account');await expect(page.getByRole('heading',{name:'Your account',exact:true})).toBeVisible();
 await page.getByRole('navigation',{name:'Sign-in options'}).getByRole('link',{name:choice,exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('buyer@example.com');await page.getByRole('button',{name:'Email me a code'}).click();await expect(page.getByLabel('One-time code',{exact:true})).toBeVisible();expect(purpose).toBe(choice==='Orders'?'orders':'tickets');
});

test('signed-in transfer sender with order access opens Orders from account link',async({page})=>{
 await setup(page,null);await page.route('**/api/me',route=>route.fulfill({json:{email:'buyer@example.com',staffRole:null,canAccessTickets:false,canAccessOrders:true,orders:[]}}));
 await page.goto('/account');await expect(page).toHaveURL(/\/account\/orders$/);await expect(page.getByRole('heading',{name:'Orders',exact:true})).toBeVisible();
});

for(const state of ['expired','canceled'])test(`signed-out ${state} invitation can be dismissed before authentication`,async({page})=>{
 await setup(page,null,false);const token=crypto.randomUUID()+crypto.randomUUID();
 await page.route('**/api/auth/request-code',route=>route.fulfill({status:403,json:{error:'Invitation unavailable'}}));
 await page.goto(`/#transfer=${token}`);await expect(page).toHaveURL(/\/account\/transfer$/);
 await page.getByLabel('Email',{exact:true}).fill('invited@example.com');await page.getByRole('button',{name:'Email me a code'}).click();await expect(page.getByRole('alert')).toContainText('Invitation unavailable');
 await page.getByRole('button',{name:'Dismiss invitation',exact:true}).click();await expect(page).toHaveURL('/');expect(await page.evaluate(()=>localStorage.getItem('takeoff-ticket-transfer'))).toBeNull();
 await page.getByRole('button',{name:'Get startup ticket',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.reload();await expect(page).toHaveURL('/');
});

test('a stored invitation does not redirect home or block registration',async({page})=>{
 await setup(page,null,false);const token=crypto.randomUUID()+crypto.randomUUID();
 await page.addInitScript(token=>localStorage.setItem('takeoff-ticket-transfer',token),token);
 await page.goto('/');await expect(page.getByRole('button',{name:'Get startup ticket',exact:true})).toBeVisible();await expect(page).toHaveURL('/');
 await page.goto('/account/transfer');await expect(page.getByRole('button',{name:'Dismiss invitation'})).toBeVisible();await page.getByRole('link',{name:'Home',exact:true}).click();await expect(page).toHaveURL('/');
 expect(await page.evaluate(()=>localStorage.getItem('takeoff-ticket-transfer'))).toBe(token);await page.getByRole('button',{name:'Get startup ticket',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
});

test('viewing paid order A preserves pending checkout B and resumes its original key',async({page})=>{
 await setup(page,null);const keyA='11111111-0000-4000-8000-000000000011',keyB='22222222-0000-4000-8000-000000000022',orderB='33333333-0000-4000-8000-000000000033';
 await page.addInitScript(({keyB,orderB})=>sessionStorage.setItem('takeoff-checkout-request',JSON.stringify({key:keyB,orderId:orderB,selection:JSON.stringify({name:'Pending buyer',email:'buyer@example.com',qty:{startup:2},discountCode:''})})),{keyB,orderB});
 await page.route(`**/api/orders/${id}`,route=>route.fulfill({json:{id,request_key:keyA,status:'paid',total_amount:3000,items:[{id:'itemA',quantity:1,label:'Earlier purchase',unit_amount:3000}],tickets:[]}}));
 let resumed=false;await page.route('**/api/create-checkout',route=>{const data=route.request().postDataJSON();expect(data.requestKey).toBe(keyB);expect(data.qty).toEqual({startup:2});resumed=true;return route.fulfill({json:{orderId:orderB,url:'https://checkout.stripe.test/pending-b'}});});
 await page.route('https://checkout.stripe.test/**',route=>route.fulfill({body:'Secure checkout'}));
 await page.goto(`/account/orders/${id}`);await expect(page.getByText(/Earlier purchase/)).toBeVisible();expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('takeoff-checkout-request')!).key)).toBe(keyB);
 await page.getByRole('link',{name:'Home',exact:true}).click();await page.getByRole('button',{name:'Get startup ticket',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Continue to secure payment'}).click();await expect(page).toHaveURL('https://checkout.stripe.test/pending-b');expect(resumed).toBe(true);
});

for(const match of ['request key','stored order ID'])test(`paid confirmation clears only a checkout matching its ${match}`,async({page})=>{
 await setup(page,null);const key='22222222-0000-4000-8000-000000000022';
 await page.addInitScript(({key,id,match})=>sessionStorage.setItem('takeoff-checkout-request',JSON.stringify({key,...(match==='stored order ID'?{orderId:id}:{}),selection:JSON.stringify({name:'Buyer',email:'buyer@example.com',qty:{startup:1},discountCode:''})})),{key,id,match});
 await page.route(`**/api/orders/${id}`,route=>route.fulfill({json:{id,...(match==='request key'?{request_key:key}:{}),status:'paid',total_amount:3000,items:[],tickets:[]}}));
 await page.goto(`/account/tickets?order=${id}`);await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('takeoff-checkout-request'))).toBeNull();
});

test('order details disappear on list navigation and while another order loads or fails',async({page})=>{
 await setup(page,null);const orderA='11111111-0000-4000-8000-000000000011',orderB='22222222-0000-4000-8000-000000000022';let releaseB!:()=>void;const pendingB=new Promise<void>(resolve=>{releaseB=resolve;});
 await page.route('**/api/me',route=>route.fulfill({json:{email:'buyer@example.com',staffRole:null,canAccessTickets:true,canAccessOrders:true,orders:[orderA,orderB].map(id=>({id,status:'paid',created_at:'2026-11-12T06:00:00Z',total_amount:3000}))}}));
 await page.route(`**/api/orders/${orderA}`,route=>route.fulfill({json:{id:orderA,status:'paid',total_amount:3000,items:[{id:'itemA',quantity:1,label:'Earlier purchase details',unit_amount:3000}],tickets:[]}}));
 await page.route(`**/api/orders/${orderB}`,async route=>{await pendingB;await route.fulfill({status:404,json:{error:'Order not found'}});});
 await page.goto(`/account/orders/${orderA}`);await expect(page.getByText(/Earlier purchase details/)).toBeVisible();await page.getByRole('link',{name:'← Back to orders',exact:true}).click();await expect(page).toHaveURL('/account/orders');await expect(page.getByText(/Earlier purchase details/)).toHaveCount(0);
 await page.getByRole('button').filter({hasText:'22222222'}).click();await expect(page.getByText('Loading order…',{exact:true})).toBeVisible();await expect(page.getByText(/Earlier purchase details/)).toHaveCount(0);
 releaseB();await expect(page.getByRole('alert')).toContainText('Order not found');await expect(page.getByText(/Earlier purchase details/)).toHaveCount(0);await expect(page.locator('.ticket-card')).toHaveCount(0);
});

for(const recovery of [{name:'completed',code:'checkout_already_completed',action:'Buy again'},{name:'aged unlinked',code:'checkout_restart_required',action:'Restart payment'}])test(`${recovery.name} checkout offers an explicit fresh purchase`,async({page})=>{
 await setup(page,null,false);const key='44444444-0000-4000-8000-000000000044';const keys:string[]=[];
 await page.addInitScript(key=>sessionStorage.setItem('takeoff-checkout-request',JSON.stringify({key,selection:JSON.stringify({name:'Guest buyer',email:'guest@example.com',qty:{startup:1},discountCode:''})})),key);
 await page.route('**/api/create-checkout',route=>{const data=route.request().postDataJSON();keys.push(data.requestKey);return data.requestKey===key?route.fulfill({status:409,json:{error:'Choose whether to start another purchase.',code:recovery.code}}):route.fulfill({json:{orderId:id,url:'https://checkout.stripe.test/fresh'}});});
 await page.route('https://checkout.stripe.test/**',route=>route.fulfill({body:'Secure checkout'}));await page.goto('/?checkout=canceled');await page.getByRole('button',{name:'Continue to secure payment'}).click();
 await expect(page.getByRole('button',{name:recovery.action,exact:true})).toBeVisible();expect(keys).toEqual([key]);
 if(recovery.name==='completed')await expect(page.getByRole('link',{name:'View purchases',exact:true})).toHaveAttribute('href','/account');
 await page.getByRole('button',{name:recovery.action,exact:true}).click();await expect(page).toHaveURL('https://checkout.stripe.test/fresh');expect(keys).toHaveLength(2);expect(keys[1]).not.toBe(key);
});

test('unavailable restored quantities can be removed before a fresh purchase',async({page})=>{
 await setup(page,null,false);const oldKey='55555555-0000-4000-8000-000000000055';let submitted=false;
 await page.addInitScript(key=>sessionStorage.setItem('takeoff-checkout-request',JSON.stringify({key,selection:JSON.stringify({name:'Guest',email:'guest@example.com',qty:{retired:100},discountCode:''})})),oldKey);
 await page.route('**/api/create-checkout',route=>{const data=route.request().postDataJSON();expect(data.qty).toEqual({startup:1});expect(data.requestKey).not.toBe(oldKey);submitted=true;return route.fulfill({json:{orderId:id,url:'https://checkout.stripe.test/available'}});});
 await page.route('https://checkout.stripe.test/**',route=>route.fulfill({body:'Secure checkout'}));await page.goto('/?checkout=canceled');const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Resume payment'})).toBeEnabled();
 await dialog.getByRole('button',{name:'Edit tickets',exact:true}).click();await dialog.getByRole('spinbutton',{name:'Startup quantity'}).fill('1');await expect(dialog.getByRole('button',{name:'Continue',exact:true})).toBeDisabled();
 await dialog.getByRole('button',{name:'Remove Retired',exact:true}).click();await expect(dialog.getByRole('button',{name:'Continue',exact:true})).toBeEnabled();expect(submitted).toBe(false);expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('takeoff-checkout-request')!).key)).toBe(oldKey);
 await dialog.getByRole('button',{name:'Continue',exact:true}).click();await dialog.getByRole('button',{name:'Continue to secure payment'}).click();await expect(page).toHaveURL('https://checkout.stripe.test/available');expect(submitted).toBe(true);
});

for(const width of [320,1280])test(`SOH quantity controls update selection and total at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await setup(page,null,false);
 let checkouts=0;await page.route('**/api/create-checkout',route=>{checkouts++;return route.fulfill({json:{}});});
 await page.goto('/');await page.getByRole('button',{name:'Get startup ticket',exact:true}).click();
 const modal=page.getByRole('dialog'),quantity=modal.getByRole('spinbutton',{name:'Startup quantity'});
 const decrease=modal.getByRole('button',{name:'Decrease Startup quantity'}),increase=modal.getByRole('button',{name:'Increase Startup quantity'});
 await expect(quantity).toHaveValue('0');await expect(decrease).toBeDisabled();
 await increase.click();await increase.click();await expect(quantity).toHaveValue('2');
 await expect(modal.locator('.ticket-quantity')).toHaveClass(/ticket-quantity--picked/);
 await expect(modal.locator('.checkout-footer strong')).toHaveText('¥6,000');
 await decrease.click();await expect(quantity).toHaveValue('1');
 await quantity.focus();await page.keyboard.press('ArrowUp');await expect(quantity).toHaveValue('2');
 await quantity.fill('100');await expect(increase).toBeDisabled();
 expect(await quantity.evaluate(el=>{const input=el as HTMLInputElement,context=document.createElement('canvas').getContext('2d')!;context.font=getComputedStyle(input).font;return input.clientWidth>=context.measureText(input.value).width;})).toBe(true);
 await decrease.click();await expect(quantity).toHaveValue('99');
 await quantity.fill('0');await expect(decrease).toBeDisabled();await expect(modal.locator('.ticket-quantity')).not.toHaveClass(/ticket-quantity--picked/);
 await expect(modal.getByRole('button',{name:'Continue',exact:true})).toBeDisabled();
 expect(checkouts).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 const fits=await modal.locator('.number-input').evaluate(el=>{const input=el.querySelector('input')!.getBoundingClientRect();const buttons=el.querySelectorAll('button');return input.left>=buttons[0].getBoundingClientRect().right&&input.right<=buttons[1].getBoundingClientRect().left;});expect(fits).toBe(true);
});

test('admin price controls respect bounds and submit the stepped value',async({page})=>{
 await setup(page);let savedAmount:number|undefined;
 await page.route('**/api/admin/ticket-types',route=>route.fulfill({json:{salesEnabled:true,ticketTypes:[{id,code:'startup',label:'Startup',public_purchase:true,deleted_at:null,ever_purchased:false,purchase_count:0,prices:[]}]}}));
 await page.route(`**/api/admin/ticket-types/${id}/prices`,route=>{savedAmount=route.request().postDataJSON().amount;return route.fulfill({json:{}});});
 await page.goto('/admin/ticket-types');await page.getByRole('button',{name:'Set price',exact:true}).click();
 const modal=page.getByRole('dialog'),amount=modal.getByRole('spinbutton',{name:'Price (JPY)'});
 await expect(amount).toHaveValue('');await modal.getByRole('button',{name:'Increase Price (JPY)'}).click();await expect(amount).toHaveValue('1');
 await expect(modal.getByRole('button',{name:'Decrease Price (JPY)'})).toBeDisabled();
 await amount.fill('99999999');await expect(modal.getByRole('button',{name:'Increase Price (JPY)'})).toBeDisabled();
 await amount.fill('4200');await modal.getByRole('button',{name:'Decrease Price (JPY)'}).click();await expect(amount).toHaveValue('4199');
 await modal.getByRole('button',{name:'Save changes',exact:true}).click();await expect(modal).toBeHidden();expect(savedAmount).toBe(4199);
});

test('admin percentage controls support decimals, empty edits, and presets',async({page})=>{
 await setup(page);let savedPercentage:number|undefined;
 await page.route('**/api/admin/ticket-types',route=>route.fulfill({json:{ticketTypes:[{id,code:'startup',label:'Startup',deleted_at:null}]}}));
 await page.route('**/api/admin/discounts',route=>{if(route.request().method()==='POST'){savedPercentage=route.request().postDataJSON().percentage;return route.fulfill({json:{}});}return route.fulfill({json:{discounts:[]}});});
 await page.goto('/admin/discounts');await page.getByRole('button',{name:'Create discount',exact:true}).click();
 const modal=page.getByRole('dialog'),percentage=modal.getByRole('spinbutton',{name:'Percentage discount'});
 await percentage.fill('');await expect(percentage).toHaveValue('');await modal.getByRole('button',{name:'Increase Percentage discount'}).click();await expect(percentage).toHaveValue('0.01');
 await expect(modal.getByRole('button',{name:'Decrease Percentage discount'})).toBeDisabled();
 await percentage.fill('12.34');await modal.getByRole('button',{name:'Increase Percentage discount'}).click();await expect(percentage).toHaveValue('12.35');
 await percentage.fill('100');await expect(modal.getByRole('button',{name:'Increase Percentage discount'})).toBeDisabled();
 await modal.getByRole('button',{name:'20%',exact:true}).click();await expect(percentage).toHaveValue('20');
 await modal.getByRole('button',{name:'Decrease Percentage discount'}).click();await expect(percentage).toHaveValue('19.99');
 await modal.getByLabel('Discount code',{exact:true}).fill('SAVE');await modal.getByRole('checkbox',{name:'Startup'}).check();
 await modal.getByRole('button',{name:'Create discount',exact:true}).click();await expect(modal).toBeHidden();expect(savedPercentage).toBe(19.99);
});

for(const type of ['startup','investor'])test(`account ${type} amount controls retain currency precision and optional values`,async({page})=>{
 await setup(page,null);let profile:Record<string,unknown>|undefined;
 await page.route('**/api/ticket-types',route=>route.fulfill({json:{salesEnabled:true,types:[],currencies:[{code:'JPY',decimals:0},{code:'USD',decimals:2}],sectors:[]}}));
 await page.route('**/api/me/tickets',route=>route.fulfill({json:{tickets:[{id,type,label:type==='startup'?'Startup':'Investor',status:'active',attendee:{full_name:'Test holder',email:'buyer@example.com'},startup:type==='startup'?{funding_amount:100,funding_currency:'JPY'}:null,investor:type==='investor'?{investment_min:100,investment_currency:'JPY'}:null,used:false,transferable:true,transfer:null}]}}));
 await page.route(`**/api/tickets/${id}/attendee`,route=>{profile=route.request().postDataJSON().profile;return route.fulfill({json:{}});});
 await page.goto(`/account/tickets/${id}/edit`);await page.locator('.optional-fields > summary').click();
 const label=type==='startup'?'Funding sought':'Typical investment — minimum',amount=page.getByRole('spinbutton',{name:label,exact:true});
 await expect(amount).toHaveValue('100');await page.getByRole('button',{name:`Increase ${label}`,exact:true}).click();await expect(amount).toHaveValue('101');
 await page.getByRole('combobox',{name:'Currency',exact:true}).selectOption('USD');await page.getByRole('button',{name:`Increase ${label}`,exact:true}).click();await expect(amount).toHaveValue('101.01');
 await amount.fill('0');await expect(page.getByRole('button',{name:`Decrease ${label}`,exact:true})).toBeDisabled();
 await amount.fill('12.34');await page.getByRole('button',{name:`Increase ${label}`,exact:true}).click();await expect(amount).toHaveValue('12.35');
 await page.getByRole('button',{name:'Save details',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/account/tickets/${id}$`));
 expect(profile?.[type==='startup'?'funding_amount':'investment_min']).toBe(1235);expect(profile?.[type==='startup'?'funding_currency':'investment_currency']).toBe('USD');
 if(type==='investor')expect(profile?.investment_max).toBeNull();
});

test('an existing pending checkout with an unavailable type resumes without changing its key',async({page})=>{
 await setup(page,null,false);const oldKey='66666666-0000-4000-8000-000000000066';
 await page.addInitScript(key=>sessionStorage.setItem('takeoff-checkout-request',JSON.stringify({key,selection:JSON.stringify({name:'Guest',email:'guest@example.com',qty:{retired:2},discountCode:''})})),oldKey);
 await page.route('**/api/create-checkout',route=>{const data=route.request().postDataJSON();expect(data.qty).toEqual({retired:2});expect(data.requestKey).toBe(oldKey);return route.fulfill({json:{orderId:id,url:'https://checkout.stripe.test/original'}});});
 await page.route('https://checkout.stripe.test/**',route=>route.fulfill({body:'Secure checkout'}));await page.goto('/?checkout=canceled');await expect(page.locator('.checkout-footer')).not.toContainText('¥0');await page.getByRole('button',{name:'Resume payment',exact:true}).click();await expect(page).toHaveURL('https://checkout.stripe.test/original');
});
