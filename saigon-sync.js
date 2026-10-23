/* Shared local-cache/API sync layer for SAIGON STAYS. */
(function(window, document){
  "use strict";

  const API_BASE = window.SAIGON_API_BASE || "https://saigon-api.johnsonc0325.workers.dev";
  const TOKEN_KEY = "saigon-share-token";
  const POLL_MS = 8000;
  const REQUEST_TIMEOUT = 8000;
  const store = window.SaigonListsStore;
  let state = store ? store.load() : {activeListId:null,filter:"all",lists:[]};
  let mode = "local", token = null, serverVersion = null;
  let onChange = function(){}, onStatus = function(){};
  let pollTimer = null, destroyed = false, syncing = false;
  let queue = [];

  function notify(){ onChange(state); }
  function setMode(next){
    if(mode===next)return;
    mode=next;
    try{onStatus(mode);}catch(error){}
  }
  function save(next){ state=store.save(next); notify(); return state; }
  function tokenFromUrl(){
    try{return new URL(window.location.href).searchParams.get("t");}catch(error){return null;}
  }
  function adoptUrlToken(){
    const urlToken=tokenFromUrl();
    if(!urlToken)return;
    token=urlToken.trim()||null;
    try{
      if(token)localStorage.setItem(TOKEN_KEY,token);
      const url=new URL(window.location.href);url.searchParams.delete("t");
      history.replaceState(null,"",url.pathname+(url.search?url.search:"")+(url.hash||""));
    }catch(error){}
  }
  function readToken(){
    adoptUrlToken();
    if(token===null){try{token=localStorage.getItem(TOKEN_KEY)||null;}catch(error){token=null;}}
    return token;
  }
  function request(path, options){
    const controller=new AbortController();
    const timer=setTimeout(function(){controller.abort();},REQUEST_TIMEOUT);
    const headers=Object.assign({"Content-Type":"application/json","X-Share-Token":token||""},(options&&options.headers)||{});
    headers["X-Client-Name"]="saigon-stays-web";
    return fetch(API_BASE+path,Object.assign({},options||{},{headers,signal:controller.signal})).then(async function(response){
      let data=null;try{data=await response.json();}catch(error){}
      if(!response.ok||!data||data.ok===false){const error=new Error(data&&data.error||"api_error");error.status=response.status;throw error;}
      return data;
    }).finally(function(){clearTimeout(timer);});
  }
  function fromApi(data){
    const lists=Array.isArray(data&&data.lists)?data.lists.map(function(list){return {
      id:String(list.id),name:String(list.name||"未命名清單"),tasks:Array.isArray(list.tasks)?list.tasks.map(function(task){return {
        id:String(task.id),title:String(task.title||"未命名待辦").trim()||"未命名待辦",done:task.done===true||task.done===1,
        priority:["high","normal","low"].includes(task.priority)?task.priority:"normal"
      };}):[]
    };}):[];
    const current=state.activeListId;
    return {activeListId:lists.some(function(list){return list.id===current;})?current:(lists[0]&&lists[0].id)||null,filter:state.filter||"all",lists};
  }
  function validateTask(input){
    const title=String(input&&input.title||"").trim();
    if(!title||title.length>200)throw new Error("待辦名稱需為 1–200 字");
    const priority=input.priority||"normal";
    if(!["high","normal","low"].includes(priority))throw new Error("優先級格式不正確");
    return {title,priority};
  }
  function validateName(name){
    const value=String(name||"").trim();
    if(!value||value.length>40)throw new Error("清單名稱需為 1–40 字");
    return value;
  }
  function opRequest(op){
    if(op.type==="addTask")return request("/api/tasks",{method:"POST",body:JSON.stringify({listId:op.listId,title:op.title,priority:op.priority,note:""})});
    if(op.type==="updateTask")return request("/api/tasks/"+encodeURIComponent(op.taskId),{method:"PATCH",body:JSON.stringify(op.patch)});
    if(op.type==="deleteTask")return request("/api/tasks/"+encodeURIComponent(op.taskId),{method:"DELETE"});
    if(op.type==="addList")return request("/api/lists",{method:"POST",body:JSON.stringify({name:op.name})});
    if(op.type==="renameList")return request("/api/lists/"+encodeURIComponent(op.listId),{method:"PATCH",body:JSON.stringify({name:op.name})});
    if(op.type==="deleteList")return request("/api/lists/"+encodeURIComponent(op.listId),{method:"DELETE"});
    return Promise.resolve();
  }
  async function fetchRemote(force){
    const data=await request("/api/lists",{method:"GET",cache:"no-store"});
    if(!force&&serverVersion!==null&&data.serverVersion===serverVersion)return false;
    serverVersion=data.serverVersion||null;save(fromApi(data));return true;
  }
  async function recover(error, op){
    if(op)queue.push(op);
    setMode("offline");
    try{await fetchRemote(true);}catch(refreshError){}
    return Promise.reject(error);
  }
  async function send(op){
    if(!token){return;}
    if(mode!=="synced"){queue.push(op);return;}
    try{await opRequest(op);await fetchRemote();}
    catch(error){return recover(error,op);}
  }
  async function flushQueue(){
    if(syncing||!token||mode!=="synced"||!queue.length)return;
    syncing=true;
    try{
      while(queue.length){const op=queue[0];await opRequest(op);queue.shift();await fetchRemote();}
    }catch(error){setMode("offline");}
    finally{syncing=false;}
  }
  async function refresh(){
    if(!token){setMode("local");return;}
    try{await fetchRemote();setMode("synced");await flushQueue();}
    catch(error){setMode("offline");throw error;}
  }
  function addTask(listId,input){
    const value=validateTask(input), list=state.lists.find(function(item){return item.id===listId;});
    if(!list) return Promise.reject(new Error("找不到清單"));
    const task={id:store.makeId("task"),title:value.title,done:false,priority:value.priority};list.tasks.unshift(task);save(state);
    return send({type:"addTask",listId,title:value.title,priority:value.priority}).catch(function(error){notify();throw error;});
  }
  function updateTask(taskId,patch){
    const task=state.lists.flatMap(function(list){return list.tasks;}).find(function(item){return item.id===taskId;});
    if(!task)return Promise.reject(new Error("找不到待辦"));
    const next={};if(patch.title!==undefined){next.title=String(patch.title).trim();if(!next.title||next.title.length>200)throw new Error("待辦名稱需為 1–200 字");task.title=next.title;}
    if(patch.priority!==undefined){if(!["high","normal","low"].includes(patch.priority))throw new Error("優先級格式不正確");next.priority=patch.priority;task.priority=patch.priority;}
    if(patch.done!==undefined){next.done=!!patch.done;task.done=!!patch.done;}
    save(state);return send({type:"updateTask",taskId,patch:next});
  }
  function deleteTask(taskId){
    let found=null;state.lists.some(function(list){const index=list.tasks.findIndex(function(task){return task.id===taskId;});if(index<0)return false;found=list.tasks.splice(index,1)[0];return true;});
    if(!found)return Promise.reject(new Error("找不到待辦"));save(state);return send({type:"deleteTask",taskId});
  }
  function addList(name){const value=validateName(name),list={id:store.makeId("list"),name:value,tasks:[]};state.lists.push(list);state.activeListId=list.id;state.filter="all";save(state);return send({type:"addList",name:value});}
  function renameList(listId,name){const value=validateName(name),list=state.lists.find(function(item){return item.id===listId;});if(!list)return Promise.reject(new Error("找不到清單"));list.name=value;save(state);return send({type:"renameList",listId,name:value});}
  function deleteList(listId){const index=state.lists.findIndex(function(list){return list.id===listId;});if(index<0)return Promise.reject(new Error("找不到清單"));state.lists.splice(index,1);state.activeListId=state.lists[0]&&state.lists[0].id||null;save(state);return send({type:"deleteList",listId});}
  async function init(opts){
    opts=opts||{};onChange=typeof opts.onChange==="function"?opts.onChange:function(){};onStatus=typeof opts.onStatus==="function"?opts.onStatus:function(){};state=store.load();notify();readToken();setMode(token?"offline":"local");
    if(token){try{await refresh();}catch(error){}}
    if(!destroyed){pollTimer=setInterval(function(){if(document.visibilityState==="visible"&&token)refresh().catch(function(){});},POLL_MS);}
  }
  async function setToken(next){
    const value=String(next||"").trim();if(!value)return false;token=value;
    try{localStorage.setItem(TOKEN_KEY,token);}catch(error){}
    queue=[];try{await refresh();return mode==="synced";}catch(error){setMode("offline");return false;}
  }
  function clearToken(){token=null;queue=[];serverVersion=null;try{localStorage.removeItem(TOKEN_KEY);}catch(error){}setMode("local");}
  function buildShareUrl(){return token?window.location.origin+window.location.pathname+"?t="+encodeURIComponent(token):window.location.origin+window.location.pathname;}
  function destroy(){destroyed=true;if(pollTimer)clearInterval(pollTimer);pollTimer=null;}
  window.SaigonSync={init,getState:function(){return state;},getMode:function(){return mode;},getToken:function(){return token;},setToken,clearToken,buildShareUrl,addTask,updateTask,deleteTask,addList,renameList,deleteList,refresh,destroy};
})(window,document);
