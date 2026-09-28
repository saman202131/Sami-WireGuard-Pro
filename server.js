const express=require("express"),path=require("path"),fs=require("fs"),crypto=require("crypto"),jwt=require("jsonwebtoken"),bcrypt=require("bcryptjs"),multer=require("multer");
const app=express(),PORT=process.env.PORT||3000,ROOT=__dirname,DATA=path.join(ROOT,"data"),DB=path.join(DATA,"store.json"),UPLOAD=path.join(ROOT,"uploads");
fs.mkdirSync(DATA,{recursive:true});fs.mkdirSync(UPLOAD,{recursive:true});
const defaults={settings:{siteName:"Sami WireGuard",supportUsername:"saman_s87",botUsername:"sami91928bot",channelUsername:"SamiWireGuard",cardNumber:"",cardName:"",categories:[{id:"wg",name:"WireGuard",active:true},{id:"dns",name:"DNS",active:false},{id:"v2ray",name:"V2Ray",active:false}],flashSale:{active:false,title:"Flash Sale",percent:0,endsAt:""},wheel:{active:true,startAt:"",endAt:""}},products:[],orders:[],customers:[],services:[],tickets:[],coupons:[],notifications:[],admins:[],audit:[],servers:[],transactions:[],missions:[],referrals:[],wheelPrizes:[],spins:[]};
function read(){if(!fs.existsSync(DB))fs.writeFileSync(DB,JSON.stringify(defaults,null,2));let d=JSON.parse(fs.readFileSync(DB));for(const k in defaults)if(d[k]===undefined)d[k]=defaults[k];return d}
function save(d){fs.writeFileSync(DB,JSON.stringify(d,null,2))}
function id(p="id"){return p+"_"+Date.now().toString(36)+"_"+crypto.randomBytes(3).toString("hex")}
function audit(d,user,action,detail){d.audit.unshift({id:id("log"),at:new Date().toISOString(),user,action,detail});d.audit=d.audit.slice(0,1000)}
app.use(express.json({limit:"2mb"}));app.use(express.urlencoded({extended:true}));
const upload=multer({dest:UPLOAD,limits:{fileSize:8*1024*1024}});
const SECRET=process.env.JWT_SECRET||"change-this-secret";
function token(user,role){return jwt.sign({user,role},SECRET,{expiresIn:"7d"})}
function auth(req,res,next){try{const h=req.headers.authorization||"";req.user=jwt.verify(h.replace(/^Bearer /,""),SECRET);next()}catch(e){res.status(401).json({error:"unauthorized"})}}
function admin(req,res,next){auth(req,res,()=>req.user.role==="admin"||req.user.role==="owner"?next():res.status(403).json({error:"forbidden"}))}
function owner(req,res,next){auth(req,res,()=>req.user.role==="owner"?next():res.status(403).json({error:"owner_only"}))}

app.post("/api/login",(req,res)=>{const u=req.body.username||"",p=req.body.password||"";const au=process.env.ADMIN_USER||"admin",ap=process.env.ADMIN_PASSWORD||"ChangeThisNow123!";if(u===au&&p===ap)return res.json({token:token(u,"owner"),user:{username:u,role:"owner"}});const d=read(),a=d.admins.find(x=>x.username===u&&x.active!==false);if(a&&(a.passwordHash?bcrypt.compareSync(p,a.passwordHash):a.password===p))return res.json({token:token(u,a.role||"admin"),user:{username:u,role:a.role||"admin"}});res.status(401).json({error:"invalid_login"})});

app.get("/api/store",(req,res)=>{const d=read();res.json({settings:{...d.settings,botToken:undefined},categories:d.settings.categories.filter(x=>x.active),products:d.products.filter(x=>x.active!==false).map(x=>({...x,stock:x.stock??0}))})});
app.get("/api/dashboard",admin,(req,res)=>{const d=read(),orders=d.orders;res.json({orders:orders.length,pending:orders.filter(x=>x.status==="pending").length,approved:orders.filter(x=>x.status==="approved").length,revenue:orders.filter(x=>x.status==="approved").reduce((s,x)=>s+Number(x.amount||0),0),products:d.products.length,customers:d.customers.length,tickets:d.tickets.filter(x=>x.status!=="closed").length,services:d.services.length})});

app.get("/api/products",admin,(req,res)=>res.json(read().products));
app.post("/api/products",admin,(req,res)=>{const d=read(),x={id:id("prd"),name:req.body.name||"Product",category:req.body.category||"wg",price:Number(req.body.price||0),duration:req.body.duration||"",volume:req.body.volume||"",stock:Number(req.body.stock||0),active:req.body.active!==false,featured:!!req.body.featured,createdAt:new Date().toISOString()};d.products.push(x);audit(d,req.user.user,"product.create",x.name);save(d);res.json(x)});
app.put("/api/products/:id",admin,(req,res)=>{const d=read(),x=d.products.find(x=>x.id===req.params.id);if(!x)return res.status(404).json({error:"not_found"});Object.assign(x,{...req.body,price:req.body.price!==undefined?Number(req.body.price):x.price,stock:req.body.stock!==undefined?Number(req.body.stock):x.stock});audit(d,req.user.user,"product.update",x.name);save(d);res.json(x)});
app.delete("/api/products/:id",admin,(req,res)=>{const d=read();d.products=d.products.filter(x=>x.id!==req.params.id);audit(d,req.user.user,"product.delete",req.params.id);save(d);res.json({ok:true})});

app.get("/api/orders",admin,(req,res)=>res.json(read().orders));
app.post("/api/orders",upload.single("receipt"),(req,res)=>{const d=read(),p=d.products.find(x=>x.id===req.body.productId);if(!p)return res.status(404).json({error:"product_not_found"});if(Number(p.stock)<=0)return res.status(409).json({error:"out_of_stock"});p.stock--;const o={id:id("ord"),productId:p.id,productName:p.name,amount:p.price,customerName:req.body.customerName||"",customerContact:req.body.customerContact||"",receipt:req.file?"/uploads/"+req.file.filename:"",status:"pending",createdAt:new Date().toISOString(),spinGranted:false,delivery:null};d.orders.unshift(o);d.customers.push({id:id("cus"),name:o.customerName,contact:o.customerContact,lastOrder:o.id,createdAt:o.createdAt});save(d);res.json(o)});
app.put("/api/orders/:id/status",admin,(req,res)=>{const d=read(),o=d.orders.find(x=>x.id===req.params.id);if(!o)return res.status(404).json({error:"not_found"});o.status=req.body.status;if(o.status==="approved"&&!o.spinGranted){o.spinGranted=true;d.spins.push({id:id("spin"),orderId:o.id,used:false,createdAt:new Date().toISOString()})}audit(d,req.user.user,"order.status",o.id+" -> "+o.status);save(d);res.json(o)});
app.put("/api/orders/:id/delivery",admin,(req,res)=>{const d=read(),o=d.orders.find(x=>x.id===req.params.id);if(!o)return res.status(404).json({error:"not_found"});o.delivery={link:req.body.link||"",config:req.body.config||"",qr:req.body.qr||"",notes:req.body.notes||"",deliveredAt:new Date().toISOString(),by:req.user.user};o.status="delivered";audit(d,req.user.user,"order.delivery",o.id);save(d);res.json(o)});

app.get("/api/settings",admin,(req,res)=>{const d=read();res.json({...d.settings,botToken:d.settings.botToken?"••••••••":""})});
app.put("/api/settings",owner,(req,res)=>{const d=read();for(const k of ["siteName","supportUsername","botUsername","channelUsername","cardNumber","cardName"])if(req.body[k]!==undefined)d.settings[k]=req.body[k];if(req.body.botToken&&req.body.botToken!=="••••••••")d.settings.botToken=req.body.botToken;if(req.body.categories)d.settings.categories=req.body.categories;if(req.body.flashSale)d.settings.flashSale=req.body.flashSale;if(req.body.wheel)d.settings.wheel=req.body.wheel;audit(d,req.user.user,"settings.update","settings");save(d);res.json(d.settings)});

app.get("/api/categories",admin,(req,res)=>res.json(read().settings.categories));
app.put("/api/categories/:id",admin,(req,res)=>{const d=read(),c=d.settings.categories.find(x=>x.id===req.params.id);if(!c)return res.status(404).json({error:"not_found"});c.active=req.body.active!==false;save(d);res.json(c)});

app.get("/api/customers",admin,(req,res)=>res.json(read().customers));
app.get("/api/services",admin,(req,res)=>res.json(read().services));
app.get("/api/tickets",admin,(req,res)=>res.json(read().tickets));
app.post("/api/tickets",(req,res)=>{const d=read(),x={id:id("tic"),name:req.body.name||"",contact:req.body.contact||"",subject:req.body.subject||"",message:req.body.message||"",status:"open",createdAt:new Date().toISOString(),replies:[]};d.tickets.unshift(x);save(d);res.json(x)});
app.put("/api/tickets/:id",admin,(req,res)=>{const d=read(),x=d.tickets.find(x=>x.id===req.params.id);if(!x)return res.status(404).json({error:"not_found"});Object.assign(x,req.body);save(d);res.json(x)});
app.get("/api/coupons",admin,(req,res)=>res.json(read().coupons));
app.post("/api/coupons",admin,(req,res)=>{const d=read(),x={id:id("cpn"),code:req.body.code,percent:Number(req.body.percent||0),amount:Number(req.body.amount||0),limit:Number(req.body.limit||0),used:0,active:true,expiresAt:req.body.expiresAt||""};d.coupons.push(x);save(d);res.json(x)});
app.put("/api/coupons/:id",admin,(req,res)=>{const d=read(),x=d.coupons.find(x=>x.id===req.params.id);if(!x)return res.status(404).json({error:"not_found"});Object.assign(x,req.body);save(d);res.json(x)});

app.get("/api/servers",admin,(req,res)=>res.json(read().servers));
app.post("/api/servers",admin,(req,res)=>{const d=read(),x={id:id("srv"),name:req.body.name||"Server",host:req.body.host||"",status:req.body.status||"online",capacity:Number(req.body.capacity||0),uptime:req.body.uptime||"",ping:req.body.ping||""};d.servers.push(x);save(d);res.json(x)});
app.put("/api/servers/:id",admin,(req,res)=>{const d=read(),x=d.servers.find(x=>x.id===req.params.id);if(!x)return res.status(404).json({error:"not_found"});Object.assign(x,req.body);save(d);res.json(x)});
app.get("/api/notifications",admin,(req,res)=>res.json(read().notifications));
app.post("/api/notifications",admin,(req,res)=>{const d=read(),x={id:id("not"),title:req.body.title||"",message:req.body.message||"",createdAt:new Date().toISOString(),read:false};d.notifications.unshift(x);save(d);res.json(x)});
app.get("/api/audit",admin,(req,res)=>res.json(read().audit));
app.get("/api/analytics",admin,(req,res)=>{const d=read(),approved=d.orders.filter(x=>x.status==="approved"||x.status==="delivered");const by={};approved.forEach(x=>{const day=x.createdAt.slice(0,10);by[day]=(by[day]||0)+Number(x.amount||0)});res.json({daily:by,total:approved.reduce((s,x)=>s+Number(x.amount||0),0),orders:approved.length,average:approved.length?approved.reduce((s,x)=>s+Number(x.amount||0),0)/approved.length:0,bestSellers:Object.values(approved.reduce((m,x)=>(m[x.productName]=(m[x.productName]||0)+1,m),{}))})});
app.get("/api/backup",owner,(req,res)=>{const d=read();res.setHeader("Content-Disposition",'attachment; filename="sami-wireguard-backup.json"');res.json(d)});

app.get("/api/wheel",auth,(req,res)=>{const d=read();res.json({active:d.settings.wheel,prizes:d.wheelPrizes.filter(x=>x.active!==false),available:d.spins.filter(x=>!x.used).length})});
app.get("/api/wheel/prizes",admin,(req,res)=>res.json(read().wheelPrizes));
app.post("/api/wheel/prizes",admin,(req,res)=>{const d=read(),x={id:id("prz"),name:req.body.name||"Prize",type:req.body.type||"none",value:req.body.value||"",probability:Number(req.body.probability||0),inventory:Number(req.body.inventory||0),active:req.body.active!==false};d.wheelPrizes.push(x);save(d);res.json(x)});
app.put("/api/wheel/prizes/:id",admin,(req,res)=>{const d=read(),x=d.wheelPrizes.find(x=>x.id===req.params.id);if(!x)return res.status(404).json({error:"not_found"});Object.assign(x,req.body);if(req.body.probability!==undefined)x.probability=Number(req.body.probability);save(d);res.json(x)});
app.delete("/api/wheel/prizes/:id",admin,(req,res)=>{const d=read();d.wheelPrizes=d.wheelPrizes.filter(x=>x.id!==req.params.id);save(d);res.json({ok:true})});
app.post("/api/wheel/spin",auth,(req,res)=>{const d=read(),s=d.spins.find(x=>!x.used);if(!s)return res.status(409).json({error:"no_spin"});const active=d.wheelPrizes.filter(x=>x.active!==false&&x.inventory!==0),total=active.reduce((n,x)=>n+Number(x.probability||0),0);if(Math.round(total*100)/100!==100)return res.status(409).json({error:"probability_must_equal_100"});let r=Math.random()*100,w=null;for(const p of active){r-=Number(p.probability);if(r<=0){w=p;break}}s.used=true;s.usedAt=new Date().toISOString();s.prize=w?w.id:null;save(d);res.json({prize:w||{name:"No prize",type:"none"}})});

app.get("/api/feature-data",admin,(req,res)=>{const d=read(),map={wallet:d.transactions,vip:d.customers,loyalty:d.transactions,missions:d.missions,referral:d.referrals,flashSale:[d.settings.flashSale],wheel:d.wheelPrizes};res.json({items:map[req.query.type]||[]})});
app.use("/uploads",express.static(UPLOAD));
app.use(express.static(ROOT));
app.get("/admin",(req,res)=>res.sendFile(path.join(ROOT,"admin.html")));
app.get("*",(req,res)=>res.sendFile(path.join(ROOT,"index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log("Sami WireGuard running on "+PORT));