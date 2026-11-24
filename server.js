'use strict';
const {connectRepository}=require('./server/mongo-repository');
const {createAppServer}=require('./server/app-server');
async function main(){
 const uri=process.env.MONGO_URI;
 const password=process.env.APP_PASSWORD;
 const dbName=process.env.MONGO_DB_NAME||'Diet&Fitness';
 const port=Number(process.env.PORT||3000);
 if(!uri||!uri.startsWith('mongodb'))throw new Error('MONGO_URI is missing from the server environment');
 if(!password||password.length<12||password.includes('REPLACE_WITH'))throw new Error('Set a unique 12+ character APP_PASSWORD in the server environment');
 if(!Number.isSafeInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
 const repository=await connectRepository(uri,dbName);
 const server=createAppServer({repository,appPassword:password,production:process.env.NODE_ENV==='production'});
 server.listen(port,'0.0.0.0',()=>console.log(`Forma server listening on port ${port} (MongoDB enabled)`));
 const stop=()=>server.close(async()=>{await repository.close();process.exit(0)});
 process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
main().catch(error=>{
 // Do not print database URI, usernames or passwords on failed connection.
 console.error('Startup failed:',error.name,':',error.message.replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi,'mongodb://[REDACTED]@'));
 process.exit(1);
});
