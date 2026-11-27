const assert=require('node:assert/strict');
// Call only with the temporary member server; never create accounts in the developer database.
module.exports=async function join(page,base,username){
  const response=await page.request.post(base+'/api/members/join',{headers:{'X-Miniroom':'1'},data:{username,name:username,nickname:username,password:'123456'}});
  assert.equal(response.status(),201);
};
