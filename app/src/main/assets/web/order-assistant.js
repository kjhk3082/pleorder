/* Conversation/history/timing ideas adapted from ars2323/PleOrder (bb91d11).
 * Implemented for Pleorder's existing repository and payment boundary.
 * Neither candidate selection nor repeated requests can authorize payment. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.PleorderAssistant=api;})(globalThis,()=>{
  'use strict';
  const MINUTE=60000, TTL=120000;
  const norm=s=>String(s||'').toLowerCase().replace(/[\s.,!?·_-]/g,'');
  const reply=(message,extra={},status='asking')=>({status,message,voiceText:message,...extra});
  const denied=s=>/(하지\s*마|하지\s*않|안\s*(해|할|돼|되)|취소|거절|아니)/.test(String(s||''));
  function quantity(value,fallback=1){
    if(value===undefined||value===null||value==='')return fallback;
    if(typeof value==='number')return Number.isInteger(value)&&value>=1&&value<=20?value:null;
    const s=String(value).trim();
    if(/^-\s*\d|^\d+\.\d+$|\d+\.\d+\s*(?:개|잔|인분|마리|명)/.test(s))return null;
    const counted=[...s.matchAll(/(\d+)\s*(?:개|잔|인분|마리|명|인(?!\s*세트))/g)];
    const m=/^\d+$/.test(s)?[s,s]:counted.at(-1);
    const words={한:1,하나:1,두:2,둘:2,세:3,셋:3,네:4,넷:4,다섯:5,여섯:6,일곱:7,여덟:8,아홉:9,열:10};
    const w=s.match(/(하나|다섯|여섯|일곱|여덟|아홉|한|두|세|네|둘|셋|넷|열)\s*(?:개|잔|인분|마리|인|명)/);
    const n=w?words[w[1]]:m?+m[1]:fallback;
    return Number.isInteger(n)&&n>=1&&n<=20?n:null;
  }
  const signature=o=>JSON.stringify(o.items.map(i=>({id:i.menuId,q:i.quantity,options:i.options||[]})).sort((a,b)=>a.id.localeCompare(b.id)));
  // These option groups belong only to the explicitly simulated demo menus.
  const demoOptions={bibimbap:[{id:'sauce',name:'고추장',choices:[{id:'separate',name:'고추장 따로',price:0},{id:'none',name:'고추장 없이',price:0}]}],burger:[{id:'cheese',name:'치즈',choices:[{id:'regular',name:'기본 치즈',price:0},{id:'extra',name:'치즈 추가',price:1000}]}],chicken:[{id:'cutlery',name:'식기',choices:[{id:'yes',name:'식기 포함',price:0},{id:'no',name:'식기 제외',price:0}]}]};
  function optionsFor(menu){return menu?.optionGroups||demoOptions[menu?.id]||[];}
  function resolveOptions(menu,selections=[]){
    if(!Array.isArray(selections)||selections.length>8)return null;
    const groups=optionsFor(menu),result=[];
    if(selections.some(x=>!groups.some(g=>g.id===x.groupId)))return null;
    for(const g of groups){const selected=selections.filter(x=>x.groupId===g.id);if(selected.length>1)return null;const choice=g.choices.find(x=>x.id===selected[0]?.id)||(selected.length?null:g.choices[0]);if(!choice||!Number.isFinite(choice.price)||choice.price<0)return null;result.push({groupId:g.id,id:choice.id,name:choice.name,price:choice.price});}
    return result;
  }
  function history(repo,query=''){
    const completed=repo.orders.filter(o=>o.stage==='completed'&&o.items?.length&&repo.store(o.storeId)).sort((a,b)=>(b.completedAt||0)-(a.completedAt||0));
    return completed.filter(o=>!query||norm(repo.store(o.storeId).name+' '+o.items.map(i=>i.name).join(' ')).includes(norm(query)));
  }
  function install(Repository,DATA,CATALOG){
    const p=Repository.prototype,oldAction=p.handleAction,oldCommand=p.handleCommand,oldDescribe=p.describe;
    p.activeOrders=function(){return this.orders.filter(o=>!['completed','cancelled'].includes(o.stage));};
    p.personalHistory=function(query=''){
      const orders=history(this,query),groups=new Map();
      for(const o of orders){const key=o.storeId+':'+signature(o);const g=groups.get(key)||{order:o,count:0};g.count++;groups.set(key,g);}
      const usual=[...groups.values()].filter(g=>g.count>=3).sort((a,b)=>b.count-a.count||(b.order.completedAt||0)-(a.order.completedAt||0))[0];
      return {last:orders[0]||null,usual:usual||null,count:orders.length};
    };
    p.menusAt=function(id){const s=this.store(id);return !s?[]:s.realPlace?(DATA.menusForStore?.(s)||[]):DATA.menus.filter(m=>m.storeId===id);};
    p.assistantChoices=function(stage,choices,context={},message=''){
      this.conversation={stage,choices,context,expiresAt:Date.now()+TTL};
      const listed=choices.map((c,i)=>`${i+1}번 ${c.name}${Number.isFinite(c.price)?` ${c.price.toLocaleString('ko-KR')}원`:''}${c.reason?`, ${c.reason}`:''}`).join('. ');
      return reply(`${message} ${listed}. 번호나 이름으로 골라 주세요.`,{conversation:{stage},candidates:choices.map((c,i)=>({...c,selection:i+1}))});
    };
    p.foodConversation=function(params={}){
      if(!params||typeof params!=='object'||Array.isArray(params))return reply('요청 내용을 다시 알려 주세요.',{},'fail');
      let {request='recommend',query='',selection,answer,fulfillment,timing}=params;
      if(String(query).length>500||String(answer||'').length>300)return reply('메뉴를 짧게 알려 주세요.',{},'fail');
      if(denied(answer)){this.conversation=null;return reply('선택을 취소했어요. 결제하지 않았어요.');}
      const c=this.conversation;
      if(request==='more'&&c?.stage==='stores')query=c.context.query||'';
      if(selection!==undefined||request==='choose'){
        if(!c||c.expiresAt<Date.now()){this.conversation=null;return reply('선택 시간이 지났어요. 가게나 메뉴를 다시 찾아 주세요.');}
        let chosen;
        if(selection!==undefined){if(!Number.isInteger(selection))return reply('목록에 나온 번호를 골라 주세요.');chosen=c.choices[selection-1];}
        else {const matches=c.choices.filter(x=>norm(x.name)===norm(answer||query));if(matches.length===1)chosen=matches[0];}
        if(!chosen)return reply('방금 안내한 목록에서 번호나 이름을 골라 주세요.',{candidates:c.choices});
        fulfillment=fulfillment||c.context.fulfillment||this.mode;timing=timing||c.context.timing||'soon';
        if(c.stage==='stores'){this.conversation=null;return this.foodConversation({request:'menus',storeId:chosen.storeId,fulfillment,timing});}
        if(c.stage==='menus'){
          const groups=optionsFor(this.menu(chosen.menuId));
          if(groups.length)return this.assistantChoices('options',groups[0].choices.map(o=>({...o,optionId:o.id})),{menuId:chosen.menuId,groupId:groups[0].id,fulfillment,timing,quantity:c.context.quantity||1},`${this.menu(chosen.menuId).name}, ${groups[0].name} 옵션을 골라 주세요. 시뮬레이션 메뉴예요.`);
          const r=this.prepare({items:[{menuId:chosen.menuId,quantity:c.context.quantity||1}],mode:fulfillment,timing});
          this.conversation=null;return r.draft?this.quoteForGleo():r;
        }
        if(c.stage==='options'){
          const r=this.prepare({items:[{menuId:c.context.menuId,quantity:c.context.quantity,options:[{groupId:c.context.groupId,id:chosen.optionId}]}],mode:fulfillment,timing});
          this.conversation=null;return r.draft?this.quoteForGleo():r;
        }
      }
      if(request==='usual'||request==='last'){
        const h=this.personalHistory(query),o=request==='usual'?h.usual?.order:h.last;
        if(!o)return reply(request==='usual'?'같은 구성으로 완료한 주문이 3회 이상 쌓이면 늘 먹던 메뉴를 찾을 수 있어요. 최근 메뉴나 먹고 싶은 음식을 알려 주세요.':'완료한 주문 이력이 아직 없어요. 먹고 싶은 음식을 알려 주세요.');
        const r=this.prepare({items:o.items,mode:fulfillment||o.mode,timing:timing||'soon',request:o.request,handoff:o.handoff});
        this.conversation=null;
        if(!r.draft)return r;
        const q=this.quoteForGleo(),prefix=request==='usual'?`같은 구성으로 ${h.usual.count}번 드신 메뉴예요. `:'최근 완료한 주문을 담았어요. ';
        return {...q,message:prefix+q.message,voiceText:prefix+q.voiceText};
      }
      if(request==='menus'||request==='detail'){
        const id=params.storeId||c?.context?.storeId||this.draft?.storeId;
        let store=this.store(id);
        if(!store&&query){const matches=this.recommend(query,this.preferences.scope,{fulfillment:fulfillment||this.mode});if(matches.length===1||norm(matches[0]?.store.name)===norm(query))store=matches[0]?.store;}
        if(!store)return this.foodConversation({request:'recommend',query,fulfillment,timing});
        const menus=this.menusAt(store.id).filter(m=>this.available(m));
        if(request==='detail'){
          const matches=menus.filter(m=>norm(m.name)===norm(query)||norm(m.id)===norm(query)||(m.aliases||[]).some(a=>norm(a)===norm(query)));
          if(matches.length===1){const m=matches[0];return reply(`${m.name}, ${m.price.toLocaleString('ko-KR')}원. ${m.desc||'상세 구성은 아직 제공되지 않아요.'} ${m.officialMenu?'공식 메뉴 정보이며 주문은 모의로 처리해요.':'시뮬레이션 메뉴예요.'}`,{menu:{id:m.id,name:m.name,price:m.price}});}
        }
        const page=Math.max(0,Number.isInteger(params.page)?params.page:0),batch=menus.slice(page*3,page*3+3);
        if(!batch.length)return reply('더 보여드릴 메뉴가 없어요. 앞서 안내한 메뉴를 골라 주세요.');
        return this.assistantChoices('menus',batch.map(m=>({menuId:m.id,name:m.name,price:m.price})),{storeId:store.id,fulfillment:fulfillment||this.mode,timing:timing||'soon',quantity:quantity(params.quantity)||1,page},`${store.name} 메뉴예요.${menus.length>(page+1)*3?' 다른 메뉴는 “더 보여 줘”라고 해 주세요.':''}`);
      }
      if(request==='more'&&c?.stage==='menus'&&c.expiresAt>Date.now())return this.foodConversation({...c.context,request:'menus',page:(c.context.page||0)+1});
      const scope=params.location==='nearby'?'nearby':params.location==='route'?'route':this.preferences.scope;
      const rows=this.recommend(query,scope,{fulfillment:fulfillment||this.mode});
      const previous=history(this),lastStore=previous[0]?.storeId;
      const filtered=params.excludeRecent?rows.filter(x=>x.store.id!==lastStore):rows;
      const sorted=filtered.map(x=>{
        const count=previous.filter(o=>o.storeId===x.store.id).length;
        const hour=new Date(this.clock).getHours();
        const contextual=previous.filter(o=>o.storeId===x.store.id&&Math.abs(new Date(o.completedAt||o.createdAt).getHours()-hour)<=2&&CATALOG.meters(o.address,this.home)<500).length;
        return {...x,count,contextual,rank:x.score-(count?Math.min(count,5)*150:0)-Math.min(contextual,3)*100};
      }).sort((a,b)=>a.rank-b.rank);
      const page=request==='more'&&c?.stage==='stores'?(c.context.page||0)+1:0;
      const list=sorted.slice(page*3,page*3+3);
      if(!list.length)return reply('조건에 맞는 다른 가게를 찾지 못했어요. 지역이나 음식 종류를 바꿔 주세요.');
      return this.assistantChoices('stores',list.map(x=>({storeId:x.store.id,name:x.store.name,reason:`${x.count?`완료 주문 ${x.count}회${x.contextual?' · 이 시간대에 드신 가게':''} · `:''}${scope==='nearby'?'현 위치':scope==='route'?'현 위치':this.home?.name||'배송지'}에서 직선 ${(x.distance/1000).toFixed(1)}km`,price:x.menu.price})),{query,fulfillment:fulfillment||this.mode,timing:timing||'soon',page},`${scope==='route'?'가는 길의':scope==='nearby'?'현재 위치 주변':this.home?.name||'배송지 주변'} 가게를 찾았어요. 배달 가능 여부와 가격은 주문 시뮬레이션 기준이에요.`);
    };
    p.amendDraft=function(params){
      const d=this.draft;
      if(!d)return reply('수정할 장바구니가 없어요. 먼저 메뉴를 골라 주세요.');
      if(denied(params.answer))return reply('주문 내용을 바꾸지 않았어요.',{draft:d});
      const items=d.items.map(i=>({...i}));
      if(params.option){
        const candidates=items.filter(i=>!params.menu||norm(i.name).includes(norm(params.menu))||i.menuId===params.menu);
        if(candidates.length!==1)return reply('옵션을 바꿀 메뉴 이름을 알려 주세요.');
        const item=candidates[0],groups=optionsFor(this.menu(item.menuId));
        const choices=groups.flatMap(g=>g.choices.filter(o=>norm(o.name)===norm(params.option)).map(o=>({...o,groupId:g.id})));
        if(choices.length!==1)return reply('등록된 옵션에서 골라 주세요. '+groups.map(g=>g.choices.map(o=>o.name).join(', ')).join('. '));
        item.options=[...(item.options||[]).filter(o=>o.groupId!==choices[0].groupId),choices[0]];
      }
      if(params.quantity!==undefined){
        const q=quantity(params.quantity);if(!q)return reply('수량은 1개부터 20개까지 알려 주세요.',{},'fail');
        const matches=items.filter(i=>!params.menu||norm(i.name).includes(norm(params.menu))||i.menuId===params.menu);
        if(matches.length!==1)return reply('어느 메뉴의 수량을 바꿀까요? 메뉴 이름도 알려 주세요.');
        matches[0].quantity=q;
      }
      if(params.remove){const ix=items.findIndex(i=>i.menuId===params.remove||norm(i.name).includes(norm(params.remove)));if(ix<0)return reply('장바구니에 없는 메뉴예요.');items.splice(ix,1);if(!items.length)return this.cancel();}
      if(params.add){
        const n=norm(params.add),matches=this.menusAt(d.storeId).filter(m=>norm(m.name)===n||m.id===params.add||(m.aliases||[]).some(a=>norm(a)===n));
        if(matches.length!==1)return reply('같은 가게의 정확한 메뉴 이름을 알려 주세요.');
        const found=items.find(i=>i.menuId===matches[0].id);if(found)found.quantity++;else items.push({menuId:matches[0].id,quantity:1});
      }
      const prepared=this.prepare({items,mode:params.fulfillment||d.mode,timing:params.timing||d.timing,handoff:d.handoff,request:params.note===undefined?d.request:String(params.note).slice(0,120)});
      this.conversation=null;this.gleoQuote=null;
      return prepared.draft?this.quoteForGleo():prepared;
    };
    p.chooseTrackedOrder=function(target){
      const all=this.activeOrders(),matches=target?this.orders.filter(o=>o.id===target||norm(this.store(o.storeId)?.name).includes(norm(target))):all;
      if(matches.length===1){this.selectedOrderId=matches[0].id;return matches[0];}return null;
    };
    p.manageOrder=function(params={}){
      if(params.action==='modify')return this.amendDraft(params);
      if(params.action==='cancel'&&this.draft&&!params.target){this.conversation=null;return this.cancel();}
      let o=this.chooseTrackedOrder(params.target);
      if(params.target&&!o)return reply('해당 주문을 하나로 찾지 못했어요. 정확한 주문 번호를 알려 주세요. 주문을 변경하지 않았어요.');
      if(!o&&this.activeOrders().length>1)return reply(`진행 중인 주문이 ${this.activeOrders().length}개예요. ${this.activeOrders().map(x=>`${this.store(x.storeId).name}, ${x.id}`).join('. ')}. 어느 주문인지 알려 주세요.`,{orders:this.activeOrders().map(x=>({id:x.id,store:this.store(x.storeId).name,stage:x.stage}))});
      o=o||this.activeOrder()||this.orders[0];
      if(params.action==='cancel')return this.cancel(o?.id);
      if(params.action==='collect')return this.collect();
      if(params.action==='resume')return this.resumeReservation(o);
      if(params.action==='number')return reply(o?`${this.store(o.storeId).name} 주문 번호는 ${o.id}예요.`:'아직 주문이 없어요.',{order:o},'success');
      return reply(this.describe(o),{order:o},'success');
    };
    p.describe=function(o){
      if(o?.stage==='reserved'||o?.stage==='held'){
        const card=o.payment,paid=`${card?.name||'등록 카드'} 끝번호 ${card?.last4||''}로 ${o.total.toLocaleString('ko-KR')}원 모의 결제됐어요.`;
        return `${this.store(o.storeId).name}, ${o.items.map(i=>`${i.name} ${i.quantity}개`).join(', ')}. ${paid} ${o.stage==='held'?`예약을 보류했어요. ${o.holdReason} 아직 매장에 보내지 않았어요. 기존 수령 장소로 계속하려면 “예약 재개”, 그만두려면 “주문 취소”라고 해 주세요.`:this.reservationSummary(o)}`;
      }
      return oldDescribe.call(this,o);
    };
    p.handleAction=function(name,params={}){
      if(!params||typeof params!=='object'||Array.isArray(params))return reply('올바르지 않은 요청이에요.',{},'fail');
      if(name==='FIND_FOOD')return this.foodConversation(params);
      if(name==='MANAGE_FOOD_ORDER')return this.manageOrder(params);
      if(name==='GET_FOOD_ORDER_STATUS'&&(params.target||this.activeOrders().length>1))return this.manageOrder({...params,action:'status'});
      if(name==='PREPARE_FOOD_ORDER'){
        if(params.reorder)return this.foodConversation({request:params.reorder,query:params.query,fulfillment:params.fulfillment,timing:params.timing});
        if(params.selection!==undefined)return this.foodConversation({...params,request:'choose'});
        if(Array.isArray(params.items)){
          if(!params.items.length||params.items.length>8)return reply('한 가게에서 최대 8가지 메뉴를 담을 수 있어요.');
          const rows=[];
          for(const item of params.items){
            const text=typeof item==='string'?item:item.name||item.menu||item.menuId||'';
            const query=String(text).replace(/(?:\d+|한|두|세|네|다섯|여섯)\s*(개|잔|인분|마리)/g,'').trim();
            let matches=this.draft?this.menusAt(this.draft.storeId):this.recommend(query,this.preferences.scope,{fulfillment:params.fulfillment||this.mode}).map(x=>x.menu);
            matches=matches.filter(m=>m.id===query||norm(m.name).includes(norm(query))||(m.aliases||[]).some(a=>norm(a)===norm(query)));
            if(!matches.length)return reply(`${query} 메뉴를 찾지 못했어요. 가게와 메뉴 이름을 다시 알려 주세요.`);
            const m=matches[0],q=quantity(typeof item==='string'?text:item.quantity,1);
            if(!q)return reply('수량은 1개부터 20개까지 알려 주세요.');
            const existing=rows.find(i=>i.menuId===m.id);if(existing)existing.quantity+=q;else rows.push({menuId:m.id,quantity:q});
          }
          const r=this.prepare({items:rows,mode:params.fulfillment||this.mode,timing:params.timing||'soon',request:params.note});
          return r.draft?this.quoteForGleo():r;
        }
      }
      if(name==='CONFIRM_FOOD_ORDER'){
        if(denied(params.utterance||params.answer))params={...params,confirmation:false};
        if(params.confirmation===false&&!params.paymentMethod&&this.draft&&(!params.draftId||params.draftId==='current'||params.draftId===this.draft.id)){this.conversation=null;this.gleoQuote=null;return this.cancel();}
        if(params.paymentMethod){
          const wanted=norm(params.paymentMethod),registered=this.payments.methods.filter(m=>m.registered);
          let card=registered.find(m=>m.label===params.paymentMethod||norm(m.name)===wanted||norm(m.nickname)===wanted);
          if(!card){const issuer=wanted.includes('현대')?'hyundai':wanted.includes('신한')?'shinhan':wanted.includes('삼성')?'samsung':null;const matches=registered.filter(m=>issuer&&m.issuer===issuer);if(matches.length===1)card=matches[0];}
          if(card)params={...params,paymentMethod:card.label};
        }
      }
      return oldAction.call(this,name,params);
    };
    p.handleCommand=function(text){
      const t=String(text||'').trim();
      if(/예약.*재개|다시.*예약/.test(t))return this.manageOrder({action:'resume'});
      if(/늘\s*먹던|평소\s*먹던/.test(t))return this.foodConversation({request:'usual'});
      if(/지난번.*(메뉴|주문)|최근.*다시/.test(t))return this.foodConversation({request:'last'});
      if(/더\s*(보여|추천)|다른\s*메뉴/.test(t))return this.foodConversation({request:'more'});
      const choice=t.match(/^(\d+)\s*번/);if(choice&&this.conversation)return this.foodConversation({selection:+choice[1],answer:t});
      if(this.conversation&&denied(t)){this.conversation=null;return reply('선택을 취소했어요. 결제하지 않았어요.');}
      if(this.draft&&/바꿔|변경/.test(t)){const q=quantity(t,null);if(q)return this.amendDraft({quantity:q});}
      return oldCommand.call(this,text);
    };
  }
  return {install,quantity,denied,norm,signature,optionsFor,resolveOptions};
});
