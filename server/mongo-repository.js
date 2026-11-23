'use strict';
const crypto=require('node:crypto');
const hashToken=token=>crypto.createHash('sha256').update(token).digest('hex');
async function connectRepository(uri,dbName){
  // Import only in production entry so the test suite does not require Atlas or a network.
  const {MongoClient}=require('mongodb');
  const client=new MongoClient(uri,{serverSelectionTimeoutMS:12000,maxPoolSize:10});
  await client.connect();
  try{
    const db=client.db(dbName);
    await db.command({ping:1});
    const stateCollection=db.collection('fitness_state');
    const sessionCollection=db.collection('fitness_sessions');
    await sessionCollection.createIndex({expiresAt:1},{expireAfterSeconds:0});
    return {
      async getState(){return stateCollection.findOne({_id:'primary'},{projection:{state:1,revision:1,updatedAt:1}});},
      async setState(state,revision){
        const now=new Date();
        if(revision===0){
          try{
            await stateCollection.insertOne({_id:'primary',state,revision:1,updatedAt:now});
            return {revision:1,updatedAt:now.toISOString()};
          }catch(err){if(err.code===11000)return null;throw err;}
        }
        const result=await stateCollection.findOneAndUpdate(
          {_id:'primary',revision},
          {$set:{state,updatedAt:now},$inc:{revision:1}},
          {returnDocument:'after',projection:{revision:1,updatedAt:1}}
        );
        return result?{revision:result.revision,updatedAt:result.updatedAt.toISOString()}:null;
      },
      async createSession(token,expiresAt){await sessionCollection.insertOne({_id:hashToken(token),expiresAt,createdAt:new Date()});},
      async hasSession(token){return !!await sessionCollection.findOne({_id:hashToken(token),expiresAt:{$gt:new Date()}},{projection:{_id:1}});},
      async deleteSession(token){await sessionCollection.deleteOne({_id:hashToken(token)});},
      async close(){await client.close();}
    };
  }catch(e){await client.close();throw e;}
}
module.exports={connectRepository};
