/* Shared lists data store for SAIGON STAYS. */
(function(window){
  "use strict";
  const storageKey="saigon-lists-v1";
  const legacyKey="saigon-packing-v1";
  const legacyTitles=["護照 / 簽證資料","手機 / 充電器 / 行動電源","轉換插頭","常用藥品","輕便雨具"];
  const validPriorities=new Set(["high","normal","low"]);

  function readLegacy(){
    try{
      const saved=JSON.parse(localStorage.getItem(legacyKey)||"[]");
      return Array.isArray(saved)?saved:[];
    }catch(error){return [];}
  }
  function makeId(prefix){
    return prefix+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7);
  }
  function defaultState(){
    const saved=readLegacy();
    return {activeListId:"packing",filter:"all",lists:[{id:"packing",name:"打包清單",tasks:legacyTitles.map((title,index)=>({id:"packing-"+index,title,done:!!saved[index],priority:"normal"}))}]};
  }
  function normalizeTask(task,index,listId){
    return {
      id:typeof task?.id==="string"&&task.id?task.id:listId+"-"+index,
      title:typeof task?.title==="string"&&task.title.trim()?task.title.trim():"未命名待辦",
      done:!!task?.done,
      priority:validPriorities.has(task?.priority)?task.priority:"normal"
    };
  }
  function normalize(state){
    if(!state||!Array.isArray(state.lists)||!state.lists.length)return defaultState();
    const lists=state.lists.map((list,index)=>{
      const id=typeof list?.id==="string"&&list.id?list.id:"list-"+index;
      return {
        id,
        name:typeof list?.name==="string"&&list.name.trim()?list.name.trim():"未命名清單",
        tasks:Array.isArray(list?.tasks)?list.tasks.map((task,taskIndex)=>normalizeTask(task,taskIndex,id)):[]
      };
    });
    const activeListId=lists.some(list=>list.id===state.activeListId)?state.activeListId:lists[0].id;
    return {activeListId,filter:["all","open","done"].includes(state.filter)?state.filter:"all",lists};
  }
  function load(){
    try{return normalize(JSON.parse(localStorage.getItem(storageKey)||"null"));}catch(error){return defaultState();}
  }
  function save(state){
    const normalized=normalize(state);
    try{
      localStorage.setItem(storageKey,JSON.stringify(normalized));
      const packing=normalized.lists.find(list=>list.id==="packing");
      if(packing)localStorage.setItem(legacyKey,JSON.stringify(packing.tasks.map(task=>task.done)));
    }catch(error){}
    return normalized;
  }
  function progress(list){
    const total=list.tasks.length,done=list.tasks.filter(task=>task.done).length;
    return {total,done,open:total-done,percent:total?Math.round(done/total*100):0};
  }
  function priorityText(priority){return priority==="high"?"重要":priority==="low"?"低優先":"一般";}
  function sortByPriority(tasks){
    const rank={high:0,normal:1,low:2};
    return tasks.map((task,index)=>({task,index})).sort((a,b)=>(rank[a.task.priority]??1)-(rank[b.task.priority]??1)||a.index-b.index).map(item=>item.task);
  }
  window.SaigonListsStore=Object.freeze({storageKey,legacyKey,load,save,defaultState,makeId,progress,priorityText,sortByPriority});
})(window);
