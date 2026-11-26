const assert=require('node:assert/strict');

async function expectedTitle(page,category,model){
  const url=new URL('/api/catalog',page.url());
  url.search=new URLSearchParams({category,q:model,featured:model});
  const response=await page.request.get(url.href);
  assert.ok(response.ok());
  const row=(await response.json()).rows.find(item=>item.model===model);
  assert.ok(row,'등록된 모델 '+model);
  const title=row.name.replace(model,'').replace(/\s+/g,' ').trim();
  if(title==='LG전자 리퍼비시')return 'LG전자 '+category+' 리퍼비시';
  return title==='LG전자'?'LG전자 '+category:title;
}

module.exports={expectedTitle};
