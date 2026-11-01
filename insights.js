'use strict';
/** Read visible real WinProducts panel text, not OCR, not generated estimates. */
function parsePanelText(input){
 const text=String(input||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').slice(0,6000);
 const get=(pattern)=>{
  const match=text.match(pattern);
  return match?match[1].trim():null;
 };
 const visits=get(/(?:MONTHLY\s+VISITS|Monthly\s+visits)\s*(?:\n|:|\s)+([\d,.]+\s*[KMB]?)/i);
 const sales=get(/(?:EST\.?\s*SALES|ESTIMATED\s+SALES|Estimated\s+sales)\s*(?:\n|:|\s)+([€$£₺]?\s*[\d,.]+\s*[KMB]?)/i);
 const trafficGrowth=get(/(?:TRAFFIC\s+GROWTH|Traffic\s+growth)\s*(?:\n|:|\s)+([+-]?[\d.,]+\s*%)/i);
 return {monthlyVisits:visits,estimatedSales:sales,trafficGrowth};
}
function summarizeMetrics(m){
 const claims=[];
 if(m.monthlyVisits)claims.push(`aylık tahmini ziyaret ${m.monthlyVisits}`);
 if(m.estimatedSales)claims.push(`tahmini satış göstergesi ${m.estimatedSales}`);
 if(m.trafficGrowth)claims.push(`trafik değişimi ${m.trafficGrowth}`);
 if(!claims.length)return null;
 return `WinProducts panelindeki ${claims.slice(0,2).join(', ')} değerleri dikkat çekiyor.`;
}
module.exports={parsePanelText,summarizeMetrics};
