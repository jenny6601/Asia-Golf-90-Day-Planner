const $=id=>document.getElementById(id);
function dailyWeatherIcon(kind){
 const bgRain="#e5e9ef",blue="#123fbd",cloud="#aeb9c8",cloudDark="#68778c",sun="#ffc928";
 const wrap=(body,rain=false)=>'<svg class="daily-weather-svg" viewBox="0 0 64 64" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="62" height="62" rx="13" fill="'+(rain?bgRain:"#1599e8")+'"/>'+body+'</svg>';
 const sunShape='<circle cx="24" cy="23" r="11" fill="'+sun+'" stroke="#e69a00" stroke-width="1.5"/><g stroke="#ffe36a" stroke-width="3" stroke-linecap="round"><path d="M24 5v5M24 36v5M6 23h5M37 23h5M11 10l4 4M33 32l4 4M37 10l-4 4M15 32l-4 4"/></g>';
 const cloudShape=(fill="#f8fbff")=>'<path d="M14 45h34a10 10 0 0 0 0-20 16 16 0 0 0-30-3 11 11 0 0 0-4 23Z" fill="'+fill+'" stroke="#71839a" stroke-width="2.2" stroke-linejoin="round"/>';
 const drops=(count)=>{const pts=count===1?[[32,49]]:count===2?[[24,49],[42,49]]:[[17,49],[29,53],[42,49],[53,53]];return pts.map(([x,y])=>'<path d="M'+x+' '+(y-7)+' C'+(x-2)+' '+(y-3)+' '+(x-5)+' '+(y+1)+' '+x+' '+(y+4)+' C'+(x+5)+' '+(y+1)+' '+(x+2)+' '+(y-3)+' '+x+' '+(y-7)+'Z" fill="'+blue+'" stroke="#092b91" stroke-width="1"/>').join("");};
 if(kind==="sun")return wrap(sunShape);
 if(kind==="partly")return wrap(sunShape+'<path d="M22 47h30a9 9 0 0 0 0-18 14 14 0 0 0-27-2 10 10 0 0 0-3 20Z" fill="#f8fbff" stroke="#71839a" stroke-width="2"/>');
 if(kind==="cloud")return wrap(cloudShape("#f0f5fb"));
 if(kind==="fog")return wrap('<path d="M9 24h46M5 34h53M11 44h42M17 53h30" stroke="#e8f3fb" stroke-width="5" stroke-linecap="round"/><path d="M13 24h38M9 34h46M15 44h34" stroke="#6d9dbd" stroke-width="2" stroke-linecap="round"/>');
 if(kind==="drizzle")return wrap(cloudShape("#c4ccd7")+drops(2),true);
 if(kind==="rain")return wrap(cloudShape("#8e9bad")+drops(4),true);
 if(kind==="storm")return wrap(cloudShape("#66758a")+'<path d="m35 27-13 19h10l-4 14 19-24H36l7-9Z" fill="#ffd52a" stroke="#d49a00" stroke-width="1.8" stroke-linejoin="round"/>'+drops(2),true);
 return '<span aria-label="無資料">—</span>';
}
function dailyWx(code){
 const n=Number(code);
 if(!Number.isFinite(n))return {icon:"—",desc:"無資料"};
 if(n===0)return {icon:dailyWeatherIcon("sun"),desc:"晴"};
 if(n<=2)return {icon:dailyWeatherIcon("partly"),desc:"多雲時晴"};
 if(n===3)return {icon:dailyWeatherIcon("cloud"),desc:"陰／多雲"};
 if([45,48].includes(n))return {icon:dailyWeatherIcon("fog"),desc:"霧"};
 if([51,53,55,56,57].includes(n))return {icon:dailyWeatherIcon("drizzle"),desc:"毛毛雨／小雨"};
 if([61,63,65,66,67,80,81,82].includes(n))return {icon:dailyWeatherIcon("rain"),desc:n>=80?"陣雨":n>=65?"大雨":"中雨"};
 if([95,96,99].includes(n))return {icon:dailyWeatherIcon("storm"),desc:"雷雨"};
 if([71,73,75,77,85,86].includes(n))return {icon:dailyWeatherIcon("cloud"),desc:"陰／多雲"};
 return {icon:dailyWeatherIcon("cloud"),desc:"陰／多雲"};
}

const COLD_JACKET_ICON_DATA = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22b%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%2331bdff%22%2F%3E%3Cstop%20offset%3D%22.55%22%20stop-color%3D%22%230879df%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23063c91%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22n%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23193d78%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23071b40%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%0A%3Cpath%20d%3D%22M22%2012Q22%203%2032%203t10%209l-3%208H25Z%22%20fill%3D%22url(%23b)%22%20stroke%3D%22%23063d82%22%20stroke-width%3D%222%22%2F%3E%3Cpath%20d%3D%22M26%2014q6-8%2012%200l-3%206h-6Z%22%20fill%3D%22url(%23n)%22%2F%3E%0A%3Cpath%20d%3D%22M22%2017%2015%2021%205%2047q-2%205%203%207l5%202q4%201%205-3l5-12v15q0%205%205%205h8q5%200%205-5V41l5%2012q1%204%205%203l5-2q5-2%203-7L49%2021l-7-4-10%205Z%22%20fill%3D%22url(%23b)%22%20stroke%3D%22%23063b80%22%20stroke-width%3D%222%22%20stroke-linejoin%3D%22round%22%2F%3E%0A%3Cpath%20d%3D%22m22%2017%2010%206%2010-6%205%204-7%208-8-3-8%203-7-8Z%22%20fill%3D%22url(%23n)%22%2F%3E%0A%3Cpath%20d%3D%22M27%2017q0-4%205-4t5%204v9H27Z%22%20fill%3D%22%230b2d62%22%20stroke%3D%22%230756aa%22%20stroke-width%3D%221.5%22%2F%3E%0A%3Cpath%20d%3D%22M32%2023v35%22%20stroke%3D%22%23eaf6ff%22%20stroke-width%3D%222.5%22%20stroke-dasharray%3D%222%202%22%2F%3E%3Crect%20x%3D%2230%22%20y%3D%2229%22%20width%3D%224%22%20height%3D%227%22%20rx%3D%221.5%22%20fill%3D%22%23ff9c12%22%2F%3E%0A%3Cpath%20d%3D%22m15%2032-5%2014%204%202%207-14M49%2032l5%2014-4%202-7-14%22%20fill%3D%22none%22%20stroke%3D%22%23082c62%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%2F%3E%0A%3Cpath%20d%3D%22m17%2034-3%209m33-9%203%209%22%20stroke%3D%22%23ff9a12%22%20stroke-width%3D%222.3%22%20stroke-linecap%3D%22round%22%2F%3E%0A%3Cpath%20d%3D%22m37%2030%204-5%203%204%203-3%204%205Z%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.5%22%20stroke-linejoin%3D%22round%22%2F%3E%0A%3Cpath%20d%3D%22M23%2055q9%203%2018%200v5q-9%203-18%200Z%22%20fill%3D%22%230753a4%22%20stroke%3D%22%23063b80%22%20stroke-width%3D%221.5%22%2F%3E%0A%3Cpath%20d%3D%22M7%2051l7%202-2%205-5-2q-2-1%200-5m43%202%207-2q2%204%200%205l-5%202Z%22%20fill%3D%22%23082b60%22%2F%3E%0A%3C%2Fsvg%3E';

// Exact hourly weather-code helpers copied from Taiwan Golf Weather PWA.
function wxIcon(code){
 const n=Number(code);
 if(!Number.isFinite(n))return '<span aria-label="無資料">—</span>';
 let kind="cloud";
 if(n===0)kind="sun";
 else if(n<=2)kind="partly";
 else if(n===3)kind="cloud";
 else if(n===45||n===48)kind="fog";
 else if([51,53,55,56,57].includes(n))kind="drizzle";
 else if([61,63,65,66,67,80,81,82].includes(n))kind="rain";
 else if([95,96,99].includes(n))kind="storm";
 else if([71,73,75,77,85,86].includes(n))kind="cloud";
 return dailyWeatherIcon(kind);
}
function wx(code){
 const n=Number(code);
 if(!Number.isFinite(n))return "無資料";
 if([95,96,99].includes(n))return "雷雨";
 if([80,81,82].includes(n))return "陣雨";
 if([61,63,65,66,67].includes(n))return "降雨";
 if([51,53,55,56,57].includes(n))return "毛毛雨／小雨";
 if([45,48].includes(n))return "有霧";
 if(n===0)return "晴朗";
 if(n<=2)return "晴時多雲";
 return "陰／多雲";
}

function score(rain,wind,gust,feel){let v=100-(rain||0)*0.55-Math.max(0,(wind||0)-12)*1.2-Math.max(0,(gust||0)-22)*0.8-Math.max(0,Math.abs((feel??24)-24)-7)*2;return Math.max(0,Math.min(100,Math.round(v)));}
function cls(v){return v>=75?"good":v>=50?"mid":"bad";}
function dir(v){if(v===null||v===undefined)return "—";return ["北","東北","東","東南","南","西南","西","西北"][Math.round(v/45)%8];}

function apparentFeelIcon(v){
 if(v===null||v===undefined||v==="")return "normal";
 const raw=String(v).trim().replace(/,/g,".");
 const match=raw.match(/[-+]?\d+(?:\.\d+)?/);
 if(!match)return "normal";
 const n=Number(match[0]);
 if(n<15)return "cold-warning";
 if(n<=19)return "cold";
 if(n<=27)return "normal";
 if(n<=30)return "hot";
 return "hot-warning";
}

function airTempColor(v){
 if(v===null||v===undefined||!Number.isFinite(Number(v)))return "#64748b";
 const n=Number(v);if(n<=15)return "#2563eb";if(n<=22)return "#0891b2";if(n<=28)return "#ea8a18";return "#dc2626";
}

function displayTemp(v){return v===null||v===undefined||!Number.isFinite(Number(v))?"—":Number(v).toFixed(1);}

function thermometerHTML(v){
 const color=airTempColor(v);
 return '<span class="temp-value" style="color:'+color+';font-size:18px;font-weight:800;white-space:nowrap"><svg aria-hidden="true" viewBox="0 0 20 28" width="13" height="18" style="vertical-align:-4px;margin-right:2px"><defs><linearGradient id="thermoFill" x1="0" y1="1" x2="0" y2="0"><stop stop-color="'+color+'"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><path d="M7 16V5a3 3 0 0 1 6 0v11a6 6 0 1 1-6 0Z" fill="#fff" stroke="'+color+'" stroke-width="2"/><path d="M10 9v11" stroke="'+color+'" stroke-width="3" stroke-linecap="round"/><circle cx="10" cy="21" r="3.5" fill="'+color+'"/></svg>'+displayTemp(v)+'</span>';
}

function apparentFeelHTML(v){
 const state=apparentFeelIcon(v);
 const color=state==="cold"||state==="cold-warning"?"#2563eb":state==="hot"||state==="hot-warning"?"#dc2626":"#16a34a";
 let icon="";
 if(state==="cold-warning"){
  // 15°C以下：依照使用者指定的藍色冰凍表情，白色冰帽、冰晶雪花及顫抖咬牙表情。
  icon='<svg aria-hidden="true" viewBox="0 0 64 64" width="40" height="40" style="display:block!important;width:40px!important;height:40px!important;min-width:40px;flex:0 0 40px;overflow:visible" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="coldWarningFace" cx="48%" cy="42%" r="65%"><stop offset="0" stop-color="#42d9df"/><stop offset=".65" stop-color="#12a9e5"/><stop offset="1" stop-color="#0874d1"/></radialGradient></defs><circle cx="32" cy="34" r="28" fill="url(#coldWarningFace)" stroke="#0872c5" stroke-width="1.8"/><path d="M5 25Q4 17 14 14Q19 5 32 7Q47 3 53 13Q62 15 58 24Q53 27 42 23L17 25Q8 31 5 25Z" fill="#d9f3ff"/><g fill="#43290e"><ellipse cx="22" cy="30" rx="4.2" ry="6"/><ellipse cx="42" cy="30" rx="4.2" ry="6"/></g><g><rect x="13" y="41" width="38" height="11" rx="5.5" fill="#fff" stroke="#0877d2" stroke-width="1.2"/><path d="M20 41v11M27 41v11M34 41v11M41 41v11M48 41v11M13 46.5h38" stroke="#aebbc7" stroke-width="1.2"/></g><g fill="none" stroke="#d9f4ff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 29v12M3 32l10 6M3 38l10-6M8 29l-2 2M8 29l2 2M8 41l-2-2M8 41l2-2"/><path d="M53 13v13M47.5 16.5l11 6M47.5 22.5l11-6M53 13l-2 2M53 13l2 2M53 26l-2-2M53 26l2-2"/><path d="M30 54v9M22 58.5h16M23.5 55l13 7.5M23.5 62l13-7.5M30 54l-2 2M30 54l2 2M30 63l-2-2M30 63l2-2M22 58.5l2-2M22 58.5l2 2M38 58.5l-2-2M38 58.5l-2 2M23.5 55l.5 3M23.5 55l3 .5M36.5 62l-.5-3M36.5 62l-3-.5M23.5 62l.5-3M23.5 62l3-.5M36.5 55l-.5 3M36.5 55l-3 .5"/></g></svg>';
 }else if(state==="cold"){
  // 15–19°C：使用新版藍色保暖外套圖示。
  icon='<img src="'+COLD_JACKET_ICON_DATA+'" alt="" width="40" height="40" style="display:block;width:40px;height:40px;object-fit:contain"/>';
 }else if(state==="hot-warning"){
  // 30°C以上：依照使用者提供的高溫表情圖，使用大紅橙色熱臉、吐舌及多處汗滴。
  icon='<svg aria-hidden="true" viewBox="0 0 64 48" width="40" height="30" style="display:block!important;width:40px!important;height:30px!important;min-width:40px;flex:0 0 40px;overflow:visible" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="extremeHeatFace" cx="48%" cy="35%" r="68%"><stop offset="0" stop-color="#ffd84a"/><stop offset=".55" stop-color="#ff7a18"/><stop offset="1" stop-color="#d92d0b"/></radialGradient><linearGradient id="extremeHeatTongue" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ff78b7"/><stop offset="1" stop-color="#e52e87"/></linearGradient></defs><circle cx="32" cy="24" r="22" fill="url(#extremeHeatFace)" stroke="#9b260d" stroke-width="1.3"/><g fill="none" stroke="#6f210e" stroke-width="2" stroke-linecap="round"><path d="M13 15q5 2 9-4M42 11q4 6 9 4"/></g><g stroke="#080808" stroke-width="1.5" stroke-linejoin="round"><path d="M10 17Q20 13 29 17L30 23Q29 28 22 28H17Q11 27 10 22Z" fill="#050505"/><path d="M34 17Q44 13 54 17L54 22Q53 27 47 28H42Q35 28 34 23Z" fill="#050505"/><path d="M29 19Q32 17 35 19" fill="none" stroke="#050505" stroke-width="2.2"/><path d="M14 18l8-1M38 18l8-1" stroke="#777" stroke-width=".9" opacity=".75"/></g><ellipse cx="32" cy="32" rx="8.5" ry="5" fill="#68130f" stroke="#50120d" stroke-width="1"/><path d="M26.5 32q0-2 5.5-2t5.5 2v9q0 5-5.5 5t-5.5-5Z" fill="url(#extremeHeatTongue)" stroke="#7b1738" stroke-width="1.1"/><path d="M32 32v10" stroke="#b51d59" stroke-width="1"/><g fill="#ff713b"><path d="M8 18q-3 4 0 7 3-3 0-7ZM18 3q-3 4 0 7 3-3 0-7ZM39 2q-3 4 0 7 3-3 0-7ZM56 20q-3 4 0 7 3-3 0-7Z"/></g><g fill="#36b9f4" stroke="#07558e" stroke-width=".8"><path d="M5 27q-4 6-4 9a4 4 0 0 0 8 0q0-3-4-9ZM59 3q-4 6-4 9a4 4 0 0 0 8 0q0-3-4-9ZM12 37q-3 4-3 6a3 3 0 0 0 6 0q0-2-3-6Z"/></g></svg>';
 }else if(state==="hot"){
  // 28–30°C：依照使用者提供的吐舌流汗表情圖，單側大汗滴、張眼、張嘴吐舌。
  icon='<svg aria-hidden="true" viewBox="0 0 64 48" width="40" height="30" style="display:block!important;width:40px!important;height:30px!important;min-width:40px;flex:0 0 40px;overflow:visible" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="hotFaceGrad" cx="48%" cy="34%" r="68%"><stop offset="0" stop-color="#ffe45b"/><stop offset=".56" stop-color="#ff8a19"/><stop offset="1" stop-color="#e83d0b"/></radialGradient><linearGradient id="hotTongueGrad" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ff83bf"/><stop offset="1" stop-color="#e8328d"/></linearGradient><linearGradient id="hotDropGrad" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b8f4ff"/><stop offset=".45" stop-color="#35bdec"/><stop offset="1" stop-color="#0874bd"/></linearGradient></defs><circle cx="34" cy="24" r="21.5" fill="url(#hotFaceGrad)" stroke="#b52d0b" stroke-width="1.1"/><path d="M16 14q6 1 11-6M43 8q5 7 11 6" fill="none" stroke="#75260f" stroke-width="2.3" stroke-linecap="round"/><ellipse cx="25" cy="22" rx="2.6" ry="3.6" fill="#5a1b10"/><ellipse cx="43" cy="22" rx="2.6" ry="3.6" fill="#5a1b10"/><ellipse cx="34" cy="33" rx="8.6" ry="5.5" fill="#64110f" stroke="#51100e" stroke-width="1"/><path d="M28.5 33q0-2 5.5-2t5.5 2v8q0 5-5.5 5t-5.5-5Z" fill="url(#hotTongueGrad)" stroke="#8b174c" stroke-width="1"/><path d="M34 33v10" stroke="#bd286c" stroke-width=".8"/><path d="M10 17c-3.8 6-6.8 9.3-6.8 13a6.8 6.8 0 0 0 13.6 0c0-3.7-3-7-6.8-13Z" fill="url(#hotDropGrad)" stroke="#0874bd" stroke-width="1.1"/><path d="M8 26q-.8 3 0 5" fill="none" stroke="#e4fbff" stroke-width="1.8" stroke-linecap="round"/></svg>';
 }else{
  // 20–27°C：保留原本綠色笑臉。
  icon='<svg aria-hidden="true" viewBox="0 0 48 48" width="30" height="30" style="display:block!important;width:30px!important;height:30px!important;min-width:30px;flex:0 0 30px;overflow:visible" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="21" fill="#16a34a"/><circle cx="17" cy="19" r="2.4" fill="#fff"/><circle cx="31" cy="19" r="2.4" fill="#fff"/><path d="M14 26Q24 39 34 26" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/></svg>';
 }
 const label=state==="cold-warning"?"低溫特別警示":state==="hot-warning"?"高溫特別警示":state==="cold"?"寒冷":state==="hot"?"炎熱":"舒適";
 return '<span class="hourly-feel-icon" data-feel-state="'+state+'" title="'+label+'" aria-label="'+label+' '+displayTemp(v)+'度" style="color:'+color+';font-weight:800;white-space:nowrap;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:4px;vertical-align:middle">'+icon+'<span>'+displayTemp(v)+'</span></span>';
}

function rainProbHTML(v){
 if(v===null||v===undefined)return "—";
 const n=Math.max(0,Math.min(100,Math.round(Number(v)))),level=n>=60?"high":n>=30?"mid":"low";
 const common='viewBox="0 0 48 42" aria-hidden="true" style="width:24px;height:21px;vertical-align:-5px;margin-right:2px;flex:none"';
 const cap='<svg viewBox="0 0 550 354" aria-hidden="true" style="width:25px;height:16px;vertical-align:-4px;margin-right:2px;flex:none"><g fill="none" stroke="#111318" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><path d="M120 198C122 88 208 5 331 5c123 0 211 98 214 231 1 47-55 56-120 34"/><path d="M120 198C210 191 323 217 425 270"/><path d="M350 237C344 177 341 91 331 5"/><path d="M238 204C238 120 269 43 331 5"/><path d="M120 198C91 216 47 240 18 259C-2 273 21 298 54 304c35 7 63-10 87-1 31 11 42 42 91 46 53 4 91-36 118-75l75-4"/></g></svg>';
 const jacket='<svg '+common+'><path d="M17 10Q17 3 24 3Q31 3 31 10L37 14 45 26 39 31 34 25 34 39H14V25L9 31 3 26 11 14Z" fill="#FDE047" stroke="#854D0E" stroke-width="2.2" stroke-linejoin="round"/><path d="M17 10Q24 18 31 10M17 10 13 16M31 10l4 6" fill="none" stroke="#A16207" stroke-width="1.8" stroke-linejoin="round"/><path d="M24 17v21M21 23h2m2 0h2" stroke="#854D0E" stroke-width="1.8" stroke-linecap="round"/><path d="M15 34h18M7 27l4 2m30-2-4 2" stroke="#A16207" stroke-width="1.6" stroke-linecap="round"/></svg>';
 const umbrella='<svg '+common+'><path d="M4 20Q6 5 24 4Q42 5 44 20Q39 16 34 20Q29 16 24 20Q19 16 14 20Q9 16 4 20Z" fill="#EF4444" stroke="#7F1D1D" stroke-width="2" stroke-linejoin="round"/><path d="M24 20v13q0 6 7 4" fill="none" stroke="#1F2937" stroke-width="2.8" stroke-linecap="round"/><path d="m11 25-3 6m16-6-3 6m16-6-3 6" stroke="#0284C7" stroke-width="2.2" stroke-linecap="round"/></svg>';
 const icon=n>=60?umbrella:n>=30?jacket:cap,label=n>=60?"高降雨機率":n>=30?"中降雨機率":"低降雨機率";
 return '<span class="rainpill '+level+'" title="'+label+'：'+n+'%"><span aria-hidden="true">'+icon+'</span><b>'+n+'%</b></span>';
}
function rainInterpretation(prob,mm,weatherCode){
 if(prob===null||prob===undefined||mm===null||mm===undefined||!Number.isFinite(Number(prob))||!Number.isFinite(Number(mm)))return '<span class="rain-interpretation neutral">—</span>';
 const p=Number(prob),r=Number(mm),code=Number(weatherCode);
 let level,label,detail;
 if([95,96,99].includes(code)||r>5){level=5;label="大雨／雷雨";detail="雷雨或雨量過大，不建議打球";}
 else if(r>2){level=4;label="持續降雨";detail="降雨量較大，建議雨衣、防水鞋及雨傘";}
 else if(p>=30||r>0.1){level=3;label="零星小雨";detail="可能短暫降雨，建議雨傘及輕便雨衣";}
 else if(p>0||r>0){level=2;label="低降雨風險";detail="降雨風險低，可正常打球，建議備輕便雨傘";}
 else{level=1;label="晴朗乾燥";detail="降雨風險極低，正常服裝，不需雨傘";}
 return '<span class="rain-interpretation level-'+level+'" title="'+detail+'"><b>'+label+'</b></span>';
}
function rainAmountHTML(v){
 if(v===null||v===undefined)return "—";
 const n=Number(v),level=n>=5?"heavy":n>0?"light":"none",drops=n<=0?0:n<1?1:n<5?2:3;
 const cloud='<svg viewBox="0 0 40 30" aria-hidden="true" style="width:27px;height:21px;vertical-align:-5px;margin-right:3px"><path d="M7 23h26a7 7 0 0 0 0-14 10 10 0 0 0-19-2 8 8 0 0 0-7 16Z" fill="#CBD5E1" stroke="#64748B" stroke-width="1.7"/></svg>';
 const drop='<svg viewBox="0 0 18 24" aria-hidden="true" style="width:13px;height:19px;vertical-align:-4px;margin-right:1px"><path d="M9 1C7 6 2 11 2 15a7 7 0 0 0 14 0C16 11 11 6 9 1Z" fill="url(#dropGradient)" stroke="#0369A1" stroke-width="1.2"/><path d="M5 15q0 3 3 4" fill="none" stroke="#E0F2FE" stroke-width="1.5" stroke-linecap="round"/><defs><linearGradient id="dropGradient" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7DD3FC"/><stop offset="1" stop-color="#0284C7"/></linearGradient></defs></svg>';
 const icons=drops?drop.repeat(drops):cloud;
 return '<span class="rainamount '+level+'" title="預報雨量 '+n.toFixed(1)+' mm"><span aria-hidden="true">'+icons+'</span><b>'+n.toFixed(1)+' mm</b></span>';
}

function chart(id,series,maxVal,colors,labels=[],unit="",chartTheme="",weatherCodes=[]){
 const el=$(id);if(!el)return;
 const canvas=el.tagName==="CANVAS"?el:el.querySelector("canvas");
 if(!canvas)return;
 const ctx=canvas.getContext("2d");if(!ctx)return;
 const dpr=Math.max(1,Math.min(3,window.devicePixelRatio||1)),cssW=canvas.clientWidth||600,cssH=240,w=Math.round(cssW*dpr),h=Math.round(cssH*dpr);
 canvas.width=w;canvas.height=h;canvas.style.width="100%";canvas.style.height=cssH+"px";
 ctx.setTransform(dpr,0,0,dpr,0,0);
 const cw=cssW,ch=cssH;
 ctx.clearRect(0,0,cw,ch);
 const vals=series.flat().filter(v=>v!==null&&Number.isFinite(v));if(!vals.length)return;
 const left=48,right=12,topPad=chartTheme==="temperature"?42:chartTheme==="rainProbability"?50:20,bottom=42,plotH=ch-topPad-bottom,plotW=cw-left-right;
 const tempMin=chartTheme==="temperature"?5:0;
 const top=chartTheme==="temperature"?35:(maxVal||Math.max(...vals,1));
 const yAt=value=>topPad+plotH-((value-tempMin)/(top-tempMin))*plotH;
 ctx.font=(chartTheme==="temperature"?"14px":"12px")+" sans-serif";ctx.textAlign="right";ctx.textBaseline="middle";
 const tickCount=chartTheme==="temperature"?6:4;
 for(let t=0;t<=tickCount;t++){
  const value=tempMin+(top-tempMin)*t/tickCount,y=yAt(value);
  ctx.strokeStyle="#e2e8f0";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();
  ctx.fillStyle="#475569";const tickText=chartTheme==="rainAmount"?value.toFixed(1):Number(value.toFixed(0));
  ctx.fillText(`${tickText}${unit}`,left-7,y);
 }
 ctx.strokeStyle="#94a3b8";ctx.beginPath();ctx.moveTo(left,topPad);ctx.lineTo(left,topPad+plotH);ctx.lineTo(w-right,topPad+plotH);ctx.stroke();
 const n=Math.max(1,series[0]?.length||0),xAt=i=>left+(i*plotW/Math.max(1,n-1));
 if(chartTheme==="temperature"&&weatherCodes.length){weatherCodes.forEach((item,i)=>{if(item===null||item===undefined)return;const code=typeof item==="object"?Number(item.code):Number(item);if(!Number.isFinite(code))return;const x=xAt(i),drizzle=code>=51&&code<=57,heavy=code===63||code===65||code===67||code===81||code===82||code>=95;ctx.save();ctx.translate(x,12);ctx.scale(.85,.85);ctx.translate(-x,-12);ctx.lineCap="round";ctx.lineJoin="round";if(code>=95){ctx.fillStyle="#30343b";ctx.strokeStyle="#111827";ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(x-5,11,5,Math.PI*.85,Math.PI*1.95);ctx.arc(x+1,8,6,Math.PI*1.05,Math.PI*1.95);ctx.arc(x+7,12,5,Math.PI*1.35,Math.PI*.55);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle="#075985";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-5,19);ctx.lineTo(x-7,23);ctx.moveTo(x+4,19);ctx.lineTo(x+2,23);ctx.stroke();}else if(heavy){ctx.fillStyle="#3b4652";ctx.strokeStyle="#111827";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x-5,11,5,Math.PI*.85,Math.PI*1.95);ctx.arc(x+1,8,6,Math.PI*1.05,Math.PI*1.95);ctx.arc(x+7,12,5,Math.PI*1.35,Math.PI*.55);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle="#3182ce";ctx.lineWidth=2;ctx.beginPath();for(const [dx,dy] of [[-9,0],[-5,0],[-1,0],[3,0],[7,0],[-3,5],[5,5]]){ctx.moveTo(x+dx+1,19+dy);ctx.lineTo(x+dx-1,23+dy);}ctx.stroke();}else if(drizzle||code>=61||code>=80){ctx.fillStyle="#D1D5DB";ctx.strokeStyle="#64748B";ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(x-5,11,5,Math.PI*.85,Math.PI*1.95);ctx.arc(x+1,8,6,Math.PI*1.05,Math.PI*1.95);ctx.arc(x+7,12,5,Math.PI*1.35,Math.PI*.55);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle="#075985";ctx.lineWidth=drizzle?1:2;ctx.beginPath();ctx.moveTo(x-5,19);ctx.lineTo(x-6,22);ctx.moveTo(x+4,19);ctx.lineTo(x+3,22);ctx.stroke();}else if(code>=45){ctx.strokeStyle="#374151";ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(x-9,10);ctx.lineTo(x+9,10);ctx.moveTo(x-10,15);ctx.lineTo(x+10,15);ctx.stroke();}else if(code===0){ctx.fillStyle="#fbbf24";ctx.strokeStyle="#92400e";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,12,6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.lineWidth=1.8;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(x,1);ctx.lineTo(x,4);ctx.moveTo(x,20);ctx.lineTo(x,23);ctx.moveTo(x-11,12);ctx.lineTo(x-8,12);ctx.moveTo(x+8,12);ctx.lineTo(x+11,12);ctx.moveTo(x-8,4);ctx.lineTo(x-6,6);ctx.moveTo(x+6,18);ctx.lineTo(x+8,20);ctx.moveTo(x+8,4);ctx.lineTo(x+6,6);ctx.moveTo(x-6,18);ctx.lineTo(x-8,20);ctx.stroke();}else if(code<=3){ctx.fillStyle="#fbbf24";ctx.strokeStyle="#92400e";ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(x-5,8,4.5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(x-5,1);ctx.lineTo(x-5,3);ctx.moveTo(x-5,13);ctx.lineTo(x-5,15);ctx.moveTo(x-12,8);ctx.lineTo(x-10,8);ctx.moveTo(x,8);ctx.lineTo(x+2,8);ctx.moveTo(x-10,3);ctx.lineTo(x-9,4);ctx.moveTo(x-1,12);ctx.lineTo(x,13);ctx.moveTo(x,3);ctx.lineTo(x-1,4);ctx.moveTo(x-9,12);ctx.lineTo(x-10,13);ctx.stroke();ctx.fillStyle="#fff";ctx.strokeStyle="#111827";ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(x-5,13,5,Math.PI*.85,Math.PI*1.95);ctx.arc(x+1,10,6,Math.PI*1.05,Math.PI*1.95);ctx.arc(x+7,14,5,Math.PI*1.35,Math.PI*.55);ctx.closePath();ctx.fill();ctx.stroke();}else{ctx.fillStyle="#fff";ctx.strokeStyle="#111827";ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(x-5,12,5,Math.PI*.85,Math.PI*1.95);ctx.arc(x+1,9,6,Math.PI*1.05,Math.PI*1.95);ctx.arc(x+7,13,5,Math.PI*1.35,Math.PI*.55);ctx.closePath();ctx.fill();ctx.stroke();}ctx.restore();});}
 ctx.textAlign="center";ctx.textBaseline="top";ctx.fillStyle="#475569";
 const step=Math.max(1,Math.ceil(n/5));
 for(let i=0;i<n;i+=step)ctx.fillText(labels[i]||String(i+1),xAt(i),topPad+plotH+8);
 if(n>1 && (n-1)%step!==0)ctx.fillText(labels[n-1]||String(n),xAt(n-1),topPad+plotH+8);
 series.forEach((arr,si)=>{
  ctx.strokeStyle=colors[si%colors.length];ctx.lineWidth=2.5;ctx.beginPath();let started=false;
  arr.forEach((v,i)=>{
   if(v===null||!Number.isFinite(v)){started=false;return;}
   const x=xAt(i),y=yAt(v);
   if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);
  });
  ctx.stroke();
  arr.forEach((v,i)=>{
   if(v===null||!Number.isFinite(v))return;
   const x=xAt(i),y=yAt(v);
   ctx.fillStyle=colors[si%colors.length];ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();
   let mark="";
   if(chartTheme==="rainAmount"){
    // 雨量圖示與①逐時表格同步：0 mm 雲、>0–<1 一滴、1–<5 兩滴、≥5 三滴。
    const drops=v<=0?0:v<1?1:v<5?2:3;
    if(drops===0){
     ctx.save();ctx.font="14px sans-serif";ctx.textAlign="center";ctx.textBaseline="bottom";ctx.fillText("☁️",x,y-7);ctx.restore();
    }else{
     ctx.save();ctx.font="14px 'Noto Color Emoji','Apple Color Emoji',sans-serif";ctx.textAlign="center";ctx.textBaseline="bottom";
     for(let d=0;d<drops;d++)ctx.fillText("💧",x+(d-(drops-1)/2)*10,y-7);
     ctx.restore();
    }
   }else if(chartTheme==="rainProbability"){
    const p=Math.max(0,Math.min(100,Math.round(v))),pointY=topPad+plotH-(v/top)*plotH,cy=Math.max(13,pointY-24);
    ctx.save();ctx.lineCap="round";ctx.lineJoin="round";
    if(p>=60){
     ctx.beginPath();ctx.moveTo(x-10,cy+1);ctx.quadraticCurveTo(x-9,cy-11,x,cy-11);ctx.quadraticCurveTo(x+9,cy-11,x+10,cy+1);ctx.quadraticCurveTo(x+5,cy-2,x+2,cy+1);ctx.quadraticCurveTo(x,cy-2,x-2,cy+1);ctx.quadraticCurveTo(x-5,cy-2,x-10,cy+1);ctx.closePath();ctx.fillStyle="#EF4444";ctx.strokeStyle="#7F1D1D";ctx.lineWidth=2;ctx.fill();ctx.stroke();
     ctx.beginPath();ctx.moveTo(x,cy+1);ctx.lineTo(x,cy+10);ctx.quadraticCurveTo(x,cy+14,x+5,cy+12);ctx.strokeStyle="#1F2937";ctx.lineWidth=2.4;ctx.stroke();
     ctx.beginPath();ctx.moveTo(x-7,cy+6);ctx.lineTo(x-9,cy+10);ctx.moveTo(x,cy+6);ctx.lineTo(x-2,cy+10);ctx.moveTo(x+7,cy+6);ctx.lineTo(x+5,cy+10);ctx.strokeStyle="#0284C7";ctx.lineWidth=2;ctx.stroke();
    }else if(p>=30){
     ctx.beginPath();ctx.moveTo(x-5,cy-7);ctx.quadraticCurveTo(x-5,cy-14,x,cy-14);ctx.quadraticCurveTo(x+5,cy-14,x+5,cy-7);ctx.lineTo(x+10,cy-3);ctx.lineTo(x+14,cy+5);ctx.lineTo(x+9,cy+9);ctx.lineTo(x+6,cy+5);ctx.lineTo(x+6,cy+13);ctx.lineTo(x-6,cy+13);ctx.lineTo(x-6,cy+5);ctx.lineTo(x-9,cy+9);ctx.lineTo(x-14,cy+5);ctx.lineTo(x-10,cy-3);ctx.closePath();ctx.fillStyle="#FDE047";ctx.strokeStyle="#854D0E";ctx.lineWidth=2;ctx.fill();ctx.stroke();
     ctx.beginPath();ctx.moveTo(x-5,cy-7);ctx.quadraticCurveTo(x,cy-1,x+5,cy-7);ctx.moveTo(x,cy-2);ctx.lineTo(x,cy+12);ctx.strokeStyle="#A16207";ctx.lineWidth=1.7;ctx.stroke();
    }else{
     // User-provided black outline golf-cap icon, matching the table and legend.
     ctx.translate(x-12,cy+1);ctx.scale(0.043,0.043);
     ctx.beginPath();ctx.moveTo(120,198);ctx.bezierCurveTo(122,88,208,5,331,5);ctx.bezierCurveTo(454,5,542,103,545,236);ctx.bezierCurveTo(546,283,490,292,425,270);
     ctx.moveTo(120,198);ctx.bezierCurveTo(210,191,323,217,425,270);
     ctx.moveTo(350,237);ctx.bezierCurveTo(344,177,341,91,331,5);
     ctx.moveTo(238,204);ctx.bezierCurveTo(238,120,269,43,331,5);
     ctx.moveTo(120,198);ctx.bezierCurveTo(91,216,47,240,18,259);ctx.bezierCurveTo(-2,273,21,298,54,304);ctx.bezierCurveTo(89,311,117,294,141,303);ctx.bezierCurveTo(172,314,183,345,232,349);ctx.bezierCurveTo(285,353,323,313,350,274);
     ctx.strokeStyle="#111318";ctx.lineWidth=10;ctx.stroke();
    }
    ctx.restore();
   }
  });
 });
 if(chartTheme==="temperature"&&series.length>=2){
  ctx.save();ctx.font="bold 12px system-ui,sans-serif";ctx.textAlign="center";
  const red=series[1],blue=series[0],labelGap=14;
  // 依每個時點兩條線的相對高低安排標籤：較高的數值在線上方，
  // 較低的數值在線下方，避免藍紅數字固定上下而交錯重疊。
  function drawTempLabel(v,i,color,placeAbove){
   if(v===null||!Number.isFinite(v))return;
   const x=xAt(i),y=yAt(v);
   let labelY=placeAbove?y-labelGap:y+labelGap;
   if(placeAbove){
    labelY=Math.max(topPad+14,labelY);
    ctx.textBaseline="bottom";
    ctx.fillStyle="rgba(255,255,255,0.96)";ctx.fillRect(x-14,labelY-14,28,16);
    ctx.fillStyle=color;ctx.fillText(Math.round(v)+"°",x,labelY);
   }else{
    labelY=Math.min(ch-bottom-16,labelY);
    ctx.textBaseline="top";
    ctx.fillStyle="rgba(255,255,255,0.96)";ctx.fillRect(x-14,labelY-1,28,16);
    ctx.fillStyle=color;ctx.fillText(Math.round(v)+"°",x,labelY);
   }
  }
  red.forEach((rv,i)=>{
   const bv=blue[i];
   if(rv===null||!Number.isFinite(rv)||bv===null||!Number.isFinite(bv))return;
   if(rv>bv){
    drawTempLabel(rv,i,"#dc2626",true);
    drawTempLabel(bv,i,"#1769aa",false);
   }else if(bv>rv){
    drawTempLabel(bv,i,"#1769aa",true);
    drawTempLabel(rv,i,"#dc2626",false);
   }else{
    drawTempLabel(bv,i,"#1769aa",true);
    drawTempLabel(rv,i,"#dc2626",false);
   }
  });
  ctx.restore();
 }
}


export function renderTaiwanPwaHourly(host,course,date,records){
 const card=document.createElement("section");card.className="weather-card departure-day-details pwa-hourly-compatible";
 const courseName=String(course?.name||"").replace(/高爾夫球場/g,"").trim();
 const heading=(n,label)=>{const h=document.createElement("h3");h.className="forecast-heading forecast-heading-"+n;h.textContent=label+"｜"+courseName+"｜"+date+"（06:00–18:00）";return h};
 const note=document.createElement("p");note.className="data-note";note.textContent="資料範圍：06:00–18:00｜逐時預報資料。";card.append(note);
 const title=heading(1,"① 逐時天氣預報");
 card.append(title);
 const tableWrap=document.createElement("div");tableWrap.className="hourly-table-wrap";
 const table=document.createElement("table");table.id="pwaHourlyTable";table.className="pwa-hourly-table";
 const headers=["🕒 時間","🌤️ 天氣","☔ 機率 %","🌧️ 雨量 mm","☔ 降雨判讀","🌡️ 氣溫 °C","🥵 體感 °C","風速 km/h","陣風 km/h","風向","濕度","雲量","UV","打球參考分數"];
 const thead=document.createElement("thead"),trh=document.createElement("tr");
 headers.forEach(v=>{const th=document.createElement("th");th.textContent=v;trh.append(th)});thead.append(trh);table.append(thead);
 const tbody=document.createElement("tbody");
 const fmt=(v,d=1)=>v===null||v===undefined||!Number.isFinite(Number(v))?"—":Number(v).toFixed(d);
 tbody.innerHTML=records.map(x=>{const sc=score(x.rain,x.wind,x.gust,x.feel);return '<tr><td><b>'+x.time+'</b></td><td><span class="wxcell"><span class="wxemoji">'+wxIcon(x.code)+'</span>'+wx(x.code)+'</span></td><td>'+rainProbHTML(x.rain)+'</td><td>'+rainAmountHTML(x.mm)+'</td><td>'+rainInterpretation(x.rain,x.mm,x.code)+'</td><td>'+thermometerHTML(x.temp)+'</td><td>'+apparentFeelHTML(x.feel)+'</td><td>'+fmt(x.wind)+'</td><td>'+fmt(x.gust)+'</td><td>'+(x.dir===null||x.dir===undefined?"—":dir(x.dir)+" "+Math.round(x.dir)+"°")+'</td><td>'+fmt(x.rh,0)+'%</td><td>'+fmt(x.cloud,0)+'%</td><td>'+fmt(x.uv)+'</td><td class="'+cls(sc)+'">'+sc+'/100</td></tr>'}).join("");
 table.append(tbody);tableWrap.append(table);card.append(tableWrap);
 const legendToggle=document.createElement("details");legendToggle.className="pwa-hourly-legend";
 const summary=document.createElement("summary");summary.textContent="顯示圖示與降雨判讀說明";legendToggle.append(summary);
 const legend=document.createElement("div");legend.className="rain-level-description";
 legend.innerHTML='<div class="rain-level-description-heading"><b>等級</b><b>名稱</b><b>打球建議</b></div><div class="rain-level-description-row"><b class="rain-lv lv1">1</b><strong>晴朗乾燥</strong><span>正常打球，不需雨傘</span></div><div class="rain-level-description-row"><b class="rain-lv lv2">2</b><strong>低降雨風險</strong><span>備妥輕便雨傘</span></div><div class="rain-level-description-row"><b class="rain-lv lv3">3</b><strong>零星小雨</strong><span>建議雨傘／雨衣</span></div><div class="rain-level-description-row"><b class="rain-lv lv4">4</b><strong>持續降雨</strong><span>雨衣及防水鞋</span></div><div class="rain-level-description-row"><b class="rain-lv lv5">5</b><strong>大雨／雷雨</strong><span>不建議打球</span></div>';
 legendToggle.append(legend);card.append(legendToggle);
 const makeChart=(id,n,label)=>{const section=document.createElement("section");section.className="card rain-chart-card pwa-hourly-chart-card";const h=heading(n,label);section.append(h);const canvas=document.createElement("canvas");canvas.id=id;canvas.height=240;canvas.width=600;section.append(canvas);card.append(section)};
 makeChart("pwaHourlyRainProbability",2,"② 每小時降雨機率圖（%）");
 makeChart("pwaHourlyRainAmount",3,"③ 每小時預報雨量圖（mm）");
 const tempSection=document.createElement("section");tempSection.className="card pwa-hourly-chart-card";tempSection.append(heading(4,"④ 逐小時氣溫與體感溫度（°C）"));const tempCanvas=document.createElement("canvas");tempCanvas.id="pwaHourlyTemperature";tempCanvas.height=260;tempCanvas.width=900;tempSection.append(tempCanvas);
 const leg=document.createElement("div");leg.className="legend";leg.innerHTML='<span style="color:#1769aa;font-weight:800">🔵 氣溫（2公尺高度）</span><span style="color:#dc2626;font-weight:800">🔴 體感溫度（Apparent temperature）</span>';tempSection.append(leg);const explanation=document.createElement("p");explanation.className="muted";explanation.textContent="比較實際預報氣溫與人體感受的估算溫度；體感溫度會受濕度、風速及日照等因素影響，並非人體核心溫度。";tempSection.append(explanation);card.append(tempSection);
 const source=document.createElement("p");source.className="muted";source.textContent="逐時資料來源：Open-Meteo 球場座標預報。圖表與表格以所選日期當地時間呈現。";card.append(source);
 host.append(card);
 const times=records.map(x=>x.time),maxOf=k=>{const vals=records.map(x=>x[k]).filter(v=>Number.isFinite(v));return vals.length?Math.max(...vals):null};
 chart("pwaHourlyRainProbability",[records.map(x=>x.rain)],100,["#15966a"],times,"%","rainProbability");
 chart("pwaHourlyRainAmount",[records.map(x=>x.mm)],Math.max(1,Math.ceil((maxOf("mm")||0)*1.2)),["#2563eb"],times," mm","rainAmount");
 chart("pwaHourlyTemperature",[records.map(x=>x.temp),records.map(x=>x.feel)],Math.max(40,maxOf("temp")||40,maxOf("feel")||40),["#1769aa","#dc2626"],times,"°C","temperature",records.map(x=>({code:x.code,mm:x.mm})));
 return card;
}
