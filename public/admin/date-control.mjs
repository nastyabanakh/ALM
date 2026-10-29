import {h,icon,button,publishedToggle} from './ui-components.mjs';

const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function dateControl({value='',withTime=false,onChange,label='Date',required=false}){
  let timeEnabled=withTime&&Boolean(value&&value.includes('T'));
  let selected=value?new Date(value.includes('T')?value:value+'T12:00:00'):null;if(selected&&!Number.isFinite(selected.getTime()))selected=null;
  let month=new Date((selected||new Date()).getFullYear(),(selected||new Date()).getMonth(),1);
  const root=h('div',{class:'date-control'}),text=h('span'),popup=h('div',{class:'date-popover',popover:'auto',role:'dialog','aria-label':label+' calendar'});
  const trigger=h('button',{type:'button',class:'date-trigger','aria-label':label,'aria-expanded':'false'},icon('calendar'),text,icon('chevron-down'));
  const hide=()=>{if(popup.matches(':popover-open'))popup.hidePopover();};
  const sync=()=>{text.textContent=selected?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',...(timeEnabled?{hour:'2-digit',minute:'2-digit'}:{})}).format(selected):'Choose a date';trigger.classList.toggle('empty',!selected);};
  const commit=()=>{sync();onChange(selected?(timeEnabled?selected.toISOString():dateKey(selected)):'');};
  const choose=d=>{const previous=selected;selected=new Date(d);selected.setHours(timeEnabled?(previous?.getHours()??12):12,timeEnabled?(previous?.getMinutes()??0):0,0,0);commit();if(!withTime)hide();draw();};
  function draw(focusKey){
    const heading=h('strong',null,new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(month)),grid=h('div',{class:'calendar-grid',role:'group','aria-label':'Choose day'});
    const moveMonth=step=>{month=new Date(month.getFullYear(),month.getMonth()+step,1);draw();};
    for(const name of ['Mo','Tu','We','Th','Fr','Sa','Su'])grid.append(h('span',{class:'calendar-weekday','aria-hidden':'true'},name));
    const start=new Date(month);start.setDate(1-(start.getDay()+6)%7);
    for(let i=0;i<42;i++){
      const day=new Date(start);day.setDate(start.getDate()+i);const key=dateKey(day),isSelected=selected&&key===dateKey(selected);
      const cell=h('button',{type:'button',class:'calendar-day'+(day.getMonth()!==month.getMonth()?' outside':'')+(isSelected?' on':''),'data-day':key,'aria-label':new Intl.DateTimeFormat('en-GB',{dateStyle:'full'}).format(day),'aria-selected':String(Boolean(isSelected)),...(key===dateKey(new Date())?{'aria-current':'date'}:{}),tabindex:isSelected||!selected&&day.getDate()===1&&day.getMonth()===month.getMonth()?'0':'-1',onclick:()=>choose(day)},String(day.getDate()));
      cell.onkeydown=e=>{const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];if(delta){e.preventDefault();const next=new Date(day);next.setDate(next.getDate()+delta);month=new Date(next.getFullYear(),next.getMonth(),1);draw(dateKey(next));}if(e.key==='Escape'){hide();trigger.focus();}};
      grid.append(cell);
    }
    const footer=h('div',{class:'calendar-footer'},button('Today',{variant:'ghost',size:'small',onclick:()=>choose(new Date())}),!required?button('Clear',{variant:'ghost',size:'small',onclick:()=>{selected=null;timeEnabled=false;commit();hide();}}):null,button('Done',{variant:'ghost',size:'small',onclick:hide}));
    const time=h('input',{type:'time','aria-label':label+' time',value:selected?`${String(selected.getHours()).padStart(2,'0')}:${String(selected.getMinutes()).padStart(2,'0')}`:'12:00'});
    time.onchange=()=>{if(!time.value)return;const [hour,minute]=time.value.split(':').map(Number);selected ||= new Date();selected.setHours(hour,minute,0,0);commit();};
    popup.replaceChildren(h('div',{class:'calendar-heading'},button('',{variant:'ghost',size:'small',icon:'arrow-left','aria-label':'Previous month',onclick:()=>moveMonth(-1)}),heading,button('',{variant:'ghost',size:'small',icon:'chevron-right','aria-label':'Next month',onclick:()=>moveMonth(1)})),grid,...(withTime?[h('div',{class:'calendar-add-time'},h('span',null,'Add time'),publishedToggle(timeEnabled,enabled=>{timeEnabled=enabled;if(selected)commit();draw();popup.querySelector('[role=switch]')?.focus({preventScroll:true});},{label:'Add time',showLabel:false,publicationHint:false})),...(timeEnabled?[h('label',{class:'calendar-time'},h('span',{class:'cap'},'Time'),time)]:[])]:[]),footer);
    if(popup.matches(':popover-open'))position();
    if(focusKey)popup.querySelector(`[data-day="${focusKey}"]`)?.focus({preventScroll:true});
  }
  function position(){const rect=trigger.getBoundingClientRect(),box=popup.getBoundingClientRect();popup.style.left=Math.max(12,Math.min(innerWidth-box.width-12,rect.left))+'px';popup.style.top=Math.max(12,rect.bottom+box.height+8<innerHeight?rect.bottom+8:rect.top-box.height-8)+'px';}
  trigger.onclick=()=>{if(popup.matches(':popover-open'))return hide();draw();popup.showPopover();position();popup.querySelector('[tabindex="0"]')?.focus({preventScroll:true});};
  popup.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(popup.matches(':popover-open'))));sync();root.append(trigger,popup);return root;
}
