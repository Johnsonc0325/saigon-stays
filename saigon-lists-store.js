/* Shared local lists data store for SAIGON STAYS.
   Profile = 「我是誰」（決定預設看哪份清單、新清單的 owner），
   但所有清單是共用的 —— 兩人都能看、都能改。 */
(function(window){
  "use strict";
  const storageKey="saigon-lists-v2";
  const oldProfileKey="saigon-lists-profiles-v1";
  const legacyKey="saigon-packing-v1";
  const profiles=[
    {id:"johnson",name:"Johnson",label:"Johnson"},
    {id:"jessie",name:"Jessie",label:"Jessie"}
  ];
  const legacyTitles=["護照 / 簽證資料","手機 / 充電器 / 行動電源","轉換插頭","常用藥品","輕便雨具"];
  const validPriorities=new Set(["high","normal","low"]);
  let activeProfileId="johnson";

  function readLegacy(){
    try{const saved=JSON.parse(localStorage.getItem(legacyKey)||"[]");return Array.isArray(saved)?saved:[];}catch(error){return [];}
  }
  function makeId(prefix){return prefix+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7);}
  function emptyState(){return {activeProfileId:"johnson",activeListId:null,filter:"all",lists:[]};}
  function defaultState(){
    const saved=readLegacy();
    return {activeProfileId:"johnson",activeListId:"packing",filter:"all",lists:[{
      id:"packing",name:"打包清單",owner:"johnson",
      tasks:legacyTitles.map((title,index)=>({id:"packing-"+index,title,done:!!saved[index],priority:"normal"}))
    }]};
  }
  function normalizeTask(task,index,listId){
    return {
      id:typeof task?.id==="string"&&task.id?task.id:listId+"-"+index,
      title:typeof task?.title==="string"&&task.title.trim()?task.title.trim():"未命名待辦",
      done:!!task?.done,
      priority:validPriorities.has(task?.priority)?task.priority:"normal"
    };
  }
  function normalize(state,fallback){
    if(!state||!Array.isArray(state.lists))return fallback||emptyState();
    const lists=state.lists.map((list,index)=>{
      const id=typeof list?.id==="string"&&list.id?list.id:"list-"+index;
      return {
        id,
        name:typeof list?.name==="string"&&list.name.trim()?list.name.trim():"未命名清單",
        owner:typeof list?.owner==="string"&&list.owner?list.owner:"shared",
        tasks:Array.isArray(list?.tasks)?list.tasks.map((task,taskIndex)=>normalizeTask(task,taskIndex,id)):[]
      };
    });
    const activeListId=lists.length?(lists.some(list=>list.id===state.activeListId)?state.activeListId:lists[0].id):null;
    const pid=profiles.some(profile=>profile.id===state.activeProfileId)?state.activeProfileId:"johnson";
    return {activeProfileId:pid,activeListId,filter:["all","open","done"].includes(state.filter)?state.filter:"all",lists};
  }
  /* 舊格式（每個 profile 各一份 lists）→ 合併成共用一份，補上 owner */
  function migrateOld(){
    try{
      const raw=JSON.parse(localStorage.getItem(oldProfileKey)||"null");
      if(!raw||!raw.profiles)return null;
      const merged=[],seen=new Set();
      ["johnson","jessie"].forEach(function(profileId){
        const part=raw.profiles[profileId];
        if(!part||!Array.isArray(part.lists))return;
        part.lists.forEach(function(list){
          if(!list||!list.id||seen.has(list.id))return;
          seen.add(list.id);
          merged.push(Object.assign({},list,{owner:list.owner||profileId}));
        });
      });
      if(!merged.length)return null;
      return {activeProfileId:raw.activeProfileId||"johnson",activeListId:merged[0].id,filter:"all",lists:merged};
    }catch(error){return null;}
  }
  function read(){
    try{
      const raw=JSON.parse(localStorage.getItem(storageKey)||"null");
      if(raw&&Array.isArray(raw.lists)){
        activeProfileId=profiles.some(profile=>profile.id===raw.activeProfileId)?raw.activeProfileId:"johnson";
        return normalize(raw);
      }
      const migrated=migrateOld();
      if(migrated){activeProfileId=migrated.activeProfileId;return normalize(migrated);}
      const older=JSON.parse(localStorage.getItem("saigon-lists-v1")||"null");
      return normalize(older,defaultState());
    }catch(error){return defaultState();}
  }
  function write(state){
    try{
      localStorage.setItem(storageKey,JSON.stringify(state));
      const packing=state.lists.find(function(list){return list.id==="packing";})
        ||state.lists.find(function(list){return typeof list.name==="string"&&list.name.indexOf("打包")>=0;});
      if(packing)localStorage.setItem(legacyKey,JSON.stringify(packing.tasks.map(function(task){return task.done;})));
    }catch(error){}
  }
  function load(){return normalize(read(),defaultState());}
  function save(state){
    const current=read();
    const next=normalize(state,current);
    next.activeProfileId=activeProfileId;
    write(next);
    return next;
  }
  function switchProfile(profileId){
    if(!profiles.some(function(profile){return profile.id===profileId;}))return load();
    const current=read();
    activeProfileId=profileId;
    const mine=current.lists.find(function(list){return list.owner===profileId;});
    const next=normalize(Object.assign({},current,{
      activeProfileId:profileId,
      activeListId:mine?mine.id:current.activeListId
    }),current);
    write(next);
    return next;
  }
  function progress(list){
    const tasks=Array.isArray(list&&list.tasks)?list.tasks:[];
    const total=tasks.length,done=tasks.filter(function(task){return task.done;}).length;
    return {total,done,open:total-done,percent:total?Math.round(done/total*100):0};
  }
  function priorityText(priority){return priority==="high"?"重要":priority==="low"?"低優先":"一般";}
  function sortByPriority(tasks){
    const rank={high:0,normal:1,low:2};
    return tasks.map(function(task,index){return {task,index};})
      .sort(function(a,b){
        const da=a.task.done?1:0,db=b.task.done?1:0;
        if(da!==db)return da-db;
        return (rank[a.task.priority]??1)-(rank[b.task.priority]??1)||a.index-b.index;
      })
      .map(function(item){return item.task;});
  }
  window.SaigonListsStore=Object.freeze({
    storageKey,legacyKey,profiles,load,save,switchProfile,
    currentProfileId:function(){return activeProfileId;},
    profileInfo:function(id){return profiles.find(function(profile){return profile.id===id;})||profiles[0];},
    makeId,progress,priorityText,sortByPriority
  });
})(window);
