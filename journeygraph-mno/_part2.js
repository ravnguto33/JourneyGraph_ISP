
var S = { screen: 'overview', personaFilter: 'all', edgeMin: null, edgeMax: null, ipedFaixas: null };

var PERSONA_MAP = {};
RAW.personas.forEach(function(p){ PERSONA_MAP[p.id] = p; });

var ESTADO_COLOR = { Normal:'#2ECC71', Atencao:'#E8B000', Excecao:'#E87000', Critico:'#FF4444' };
var REDE_ESTADO_COLOR = { Saudavel:'#2ECC71', Degradado:'#E8B000', Critico:'#E87000', Falha:'#FF4444' };

/* ── Capacidade (regressão) e Outliers (MAD) — portados de verdade de
   netgraph/index.html (§5.4 CAMADA DE ML), mesma matemática, aplicada
   aqui à série diária de 15 dias por site/SGW em vez da série horária
   de 60h do NetGraph fixo. ───────────────────────────────────────── */
function median(arr){
  var s=arr.slice().sort(function(a,b){return a-b;});
  var n=s.length;
  return n%2 ? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2;
}
function robustOutliers(series){
  var med = median(series);
  var absDev = series.map(function(x){ return Math.abs(x-med); });
  var mad = median(absDev) || 1e-6;
  var z = series.map(function(x){ return 0.6745*(x-med)/mad; });
  var isOutlier = z.map(function(v){ return Math.abs(v)>3.5; });
  return {median:med, mad:mad, z:z, isOutlier:isOutlier, lastZ:z[z.length-1], isOutlierNow:isOutlier[isOutlier.length-1]};
}
function linreg(xs, ys){
  var n=xs.length;
  var mx=xs.reduce(function(a,b){return a+b;},0)/n;
  var my=ys.reduce(function(a,b){return a+b;},0)/n;
  var sxy=0, sxx=0;
  for(var i=0;i<n;i++){ sxy+=(xs[i]-mx)*(ys[i]-my); sxx+=(xs[i]-mx)*(xs[i]-mx); }
  var b = sxx===0?0:sxy/sxx;
  var a = my-b*mx;
  var sse=0;
  for(var j=0;j<n;j++){ var pred=a+b*xs[j]; sse+=(ys[j]-pred)*(ys[j]-pred); }
  var dof=Math.max(1,n-2);
  var mse=sse/dof;
  var seB = sxx===0?0:Math.sqrt(mse/sxx);
  var sst=ys.reduce(function(s,y){return s+(y-my)*(y-my);},0);
  var r2 = sst===0?1:1-(sse/sst);
  return {a:a,b:b,seB:seB,mse:mse,r2:r2,n:n};
}
/* Projeta quando o tráfego cruza thresholdPct do PICO diário observado
   na própria janela do nó (não há capacidade nominal de equipamento no
   dataset — ver RAW.series_rede.metodologia). xs = índice do dia (0-14). */
function capacityProjection(trafegoSerie, thresholdPct){
  thresholdPct = thresholdPct||90;
  var peak = Math.max.apply(null, trafegoSerie);
  var ys = trafegoSerie.map(function(v){ return peak>0 ? (v/peak*100) : 0; });
  var xs = ys.map(function(_,i){return i;});
  var reg = linreg(xs, ys);
  var lastT = xs.length-1;
  var lastVal = ys[ys.length-1];
  var alreadyAbove = lastVal>=thresholdPct;
  if(reg.b<=0.5){
    return {hasProjection:false, reg:reg, peak:peak, alreadyAbove:alreadyAbove,
      reason: alreadyAbove ? "Já no pico da janela observada, sem tendência de crescimento clara — projeção não se aplica; ação é imediata, não preditiva." : "Sem tendência de crescimento relevante na janela observada (15 dias)."};
  }
  var tCross = (thresholdPct - reg.a) / reg.b;
  var bLow = reg.b - 1.96*reg.seB, bHigh = reg.b + 1.96*reg.seB;
  var tCrossOptimistic = bHigh>0.01 ? (thresholdPct-reg.a)/bHigh : Infinity;
  var tCrossPessimistic = bLow>0.01 ? (thresholdPct-reg.a)/bLow : Infinity;
  var daysFromNow = tCross - lastT;
  var daysLow = tCrossOptimistic - lastT, daysHigh = tCrossPessimistic - lastT;
  if(alreadyAbove || daysFromNow<=0 || !isFinite(daysFromNow)){
    return {hasProjection:false, reg:reg, peak:peak, alreadyAbove:alreadyAbove,
      reason: alreadyAbove ? "Já em ou acima de "+thresholdPct+"% do pico observado — ação imediata, não uma projeção futura." : "Ponto de cruzamento projetado no passado dentro do ruído da regressão; sem projeção futura confiável."};
  }
  return { hasProjection:true, reg:reg, peak:peak, thresholdPct:thresholdPct,
    daysFromNow:daysFromNow, daysLow:daysLow, daysHigh:daysHigh, alreadyAbove:alreadyAbove };
}

function fmtN(n){ return Number(n).toLocaleString('pt-BR'); }
function fmtPct(x){ return (x*100).toFixed(1)+'%'; }

/* ── Navegação ─────────────────────────────────────────────────────── */
function switchScreen(name){
  S.screen = name;
  document.querySelectorAll('.nav-btn[data-screen]').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-screen')===name);
  });
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
  document.getElementById('screen-'+name).classList.add('active');
  document.body.className = 'screen-'+name;
  _closeAllSidebars();
  if(name==='overview') renderOverview();
  if(name==='glossario') renderGlossario();
  if(name==='graph'){ renderMetrics(); renderGraph(); }
  if(name==='map'){ renderMetrics(); renderMap(); }
  if(name==='rgjourney') renderRGJourney();
  if(name==='rede') renderRede();
  if(name==='outliers') renderOutliers();
  if(name==='deteccao') renderDeteccao();
  if(name==='personas') renderPersonas();
  if(name==='quality') renderQuality();
  if(name==='alerts') renderAlerts();
  if(name==='assistant') renderAssistant();
  if(name==='restricted') renderRestricted();
}

function _toggleSidebar(id){
  var el = document.getElementById(id);
  el.classList.toggle('sidebar-open');
  var backdrop = document.getElementById('sidebar-backdrop');
  var anyOpen = document.getElementById('left-col').classList.contains('sidebar-open') ||
                document.getElementById('cat-sidebar').classList.contains('sidebar-open');
  backdrop.classList.toggle('show', anyOpen);
}
function _closeAllSidebars(){
  document.getElementById('left-col').classList.remove('sidebar-open');
  document.getElementById('cat-sidebar').classList.remove('sidebar-open');
  document.getElementById('sidebar-backdrop').classList.remove('show');
}

/* ── Filtro global de persona (sidebar esquerda + legenda direita) ──── */
function buildPersonaFilter(){
  var wrap = document.getElementById('persona-filter-buttons');
  var html = '<button class="fbtn active" data-p="all" onclick="_setPersonaFilter(\'all\')">Todas</button>';
  RAW.personas.forEach(function(p){
    html += '<button class="fbtn" data-p="'+p.id+'" onclick="_setPersonaFilter(\''+p.id+'\')">'+p.id+' · '+p.nome+'</button>';
  });
  wrap.innerHTML = html;

  var leg = document.getElementById('persona-legend');
  var lh = '';
  RAW.personas.forEach(function(p){
    lh += '<div class="leg-item"><span class="leg-dot" style="background:#'+p.cor_hex+'"></span>'+
          '<span class="leg-name">'+p.id+' '+p.nome+'</span><span class="leg-pct">'+p.pct+'%</span></div>';
  });
  leg.innerHTML = lh;
}
/* ── Filtro por faixa IPED (Índice Ponderado de qualidade no
   DEslocamento — mesma metodologia do StepGraph, agora sobre o CDR
   móvel) ──────────────────────────────────────────────────────── */
function buildIpedFilter(){
  S.ipedFaixas = {};
  RAW.iped_faixas.forEach(function(f){ S.ipedFaixas[f.faixa] = true; });
  var wrap = document.getElementById('iped-filter-buttons');
  var html = '';
  RAW.iped_faixas.forEach(function(f){
    html += '<button class="fbtn iped-fbtn" data-faixa="'+f.faixa+'" onclick="_toggleIpedFaixa(\''+f.faixa+'\')" '+
      'style="border-left:4px solid #'+f.cor_hex+'">'+f.rotulo+'</button>';
  });
  wrap.innerHTML = html;
}
function _toggleIpedFaixa(faixa){
  S.ipedFaixas[faixa] = !S.ipedFaixas[faixa];
  document.querySelectorAll('.iped-fbtn').forEach(function(b){
    b.classList.toggle('off', !S.ipedFaixas[b.getAttribute('data-faixa')]);
  });
  if(S.screen==='graph') renderGraph();
}
function _setPersonaFilter(pid){
  S.personaFilter = pid;
  document.querySelectorAll('#persona-filter-buttons .fbtn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-p')===pid);
  });
  if(S.screen==='graph') renderGraph();
  if(S.screen==='rgjourney') renderRGJourney();
}

/* ── Filtros compartilhados: Dispositivos/Pessoas, Segmento, Cluster,
   Dia + Período. Aplicados em Dígrafo, Mapa, Qualidade (todos) e
   Rede/Outliers (só dia+período, via série real de series_rede). ──── */
Object.assign(S, { segmento:'all', clusters:null, dia:'all', periodo:'all',
  peopleMode:'devices', peopleParams:{m:1,c:1,p:1}, nodeMin:null, nodeMax:null });

function peopleVal(n){
  if(S.peopleMode!=='pessoas') return n;
  return n * S.peopleParams.m * S.peopleParams.c * S.peopleParams.p;
}
function fmtPeople(n){ return fmtN(Math.round(peopleVal(n))); }

function _refreshCurrentScreen(){
  if(S.screen==='graph') renderGraph();
  else if(S.screen==='map') renderMap();
  else if(S.screen==='rgjourney') renderRGJourney();
  else if(S.screen==='rede') renderRede();
  else if(S.screen==='outliers') _outRenderMain();
  else if(S.screen==='quality') renderQuality();
}

function _setPeopleMode(mode){
  S.peopleMode = mode;
  document.querySelectorAll('.people-mode-btn').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-mode')===mode); });
  _refreshCurrentScreen();
}
function _updatePeopleParamsSummary(){
  var el = document.getElementById('people-params-summary');
  if(!el) return;
  var pp = S.peopleParams;
  el.textContent = S.peopleMode==='pessoas' ? ('m='+Math.round(pp.m*100)+'% · c='+Math.round(pp.c*100)+'% · p='+Math.round(pp.p*100)+'%') : '';
}
function _configurePeopleParams(){
  var pp = S.peopleParams;
  var m = parseFloat(window.prompt('Market share da operadora, em % (m)', String(Math.round(pp.m*100))));
  var c = parseFloat(window.prompt('Parcela de dispositivos não-IoT, em % (c)', String(Math.round(pp.c*100))));
  var p = parseFloat(window.prompt('Penetração de celular na população, em % (p)', String(Math.round(pp.p*100))));
  if(!isNaN(m)) pp.m = Math.max(0, m/100);
  if(!isNaN(c)) pp.c = Math.max(0, c/100);
  if(!isNaN(p)) pp.p = Math.max(0, p/100);
  _updatePeopleParamsSummary();
  _refreshCurrentScreen();
}

function _setSegmento(seg){
  S.segmento = seg;
  document.querySelectorAll('#segmento-filter-group .fbtn').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-seg')===seg); });
  _refreshCurrentScreen();
}

function buildClusterFilter(){
  S.clusters = null;
  var wrap = document.getElementById('cluster-filter-list');
  var html = '<label class="cl-item"><input type="checkbox" id="cluster-filter-all-cb" checked onchange="_setClusterAll(this.checked)"><b>Todos</b></label>';
  RAW.nodes.forEach(function(n){
    html += '<label class="cl-item"><input type="checkbox" class="cl-node-cb" value="'+n.id+'" checked onchange="_toggleCluster()">'+
      n.id.replace('CLUSTER_','')+' · '+(n.area_nome||'')+'</label>';
  });
  wrap.innerHTML = html;
}
function _setClusterAll(checked){
  document.querySelectorAll('.cl-node-cb').forEach(function(cb){ cb.checked = checked; });
  S.clusters = checked ? null : [];
  _refreshCurrentScreen();
}
function _toggleCluster(){
  var all = Array.prototype.slice.call(document.querySelectorAll('.cl-node-cb'));
  var checked = all.filter(function(cb){ return cb.checked; }).map(function(cb){ return cb.value; });
  var allCb = document.getElementById('cluster-filter-all-cb');
  if(checked.length===all.length){ S.clusters=null; if(allCb) allCb.checked=true; }
  else { S.clusters=checked; if(allCb) allCb.checked=false; }
  _refreshCurrentScreen();
}

function buildDiaPeriodoFilter(){
  var sel = document.getElementById('dia-filter-select');
  var dias = (RAW.personas_daily && RAW.personas_daily.dias) || [];
  var html = '<option value="all">Todos os dias</option>';
  dias.forEach(function(d,i){ html += '<option value="'+i+'">'+d+'</option>'; });
  sel.innerHTML = html;
}
function _setDia(v){ S.dia = v==='all' ? 'all' : parseInt(v,10); _refreshCurrentScreen(); }
function _setPeriodo(v){ S.periodo = v; _refreshCurrentScreen(); }

function _clusterAllowed(id){ return S.clusters==null || S.clusters.indexOf(id)!==-1; }

/* Retorna nodes (clones) já filtrados por cluster, com n_usuarios/drop/cong
   ajustados por dia (série sintética diária) e por segmento (mix_segmento). */
function _filteredNodesForDisplay(){
  return RAW.nodes.filter(function(n){ return _clusterAllowed(n.id); }).map(function(n){
    var nn = Object.assign({}, n);
    if(S.dia!=='all' && n.daily){
      nn.n_usuarios = n.daily.n_usuarios[S.dia];
      nn.drop_medio = n.daily.drop_medio[S.dia];
      nn.cong_medio = n.daily.cong_medio[S.dia];
    }
    if(S.segmento!=='all' && n.mix_segmento){
      var share = n.mix_segmento[S.segmento] / (n.n_usuarios||1);
      nn.n_usuarios = Math.round(nn.n_usuarios * share);
    }
    nn.n_usuarios = Math.round(peopleVal(nn.n_usuarios));
    return nn;
  });
}
/* Retorna edges (clones) filtrados por dia/segmento/período, restritos aos
   nodes ainda presentes em nodeIdSet (pós-filtro de cluster). */
function _filteredEdgesForDisplay(nodeIdSet){
  return RAW.edges.filter(function(e){
    return !nodeIdSet || (nodeIdSet[e.source] && nodeIdSet[e.target]);
  }).map(function(e){
    var ee = Object.assign({}, e);
    if(S.dia!=='all' && e.daily){
      ee.n_usuarios = e.daily.n_usuarios[S.dia];
      ee.n_viagens = e.daily.n_viagens[S.dia];
      ee.periodo_predominante = e.daily.periodo_predominante[S.dia];
    }
    if(S.segmento!=='all' && e.mix_segmento){
      var share = e.mix_segmento[S.segmento] / (e.n_usuarios||1);
      ee.n_usuarios = Math.round(ee.n_usuarios * share);
    }
    ee.n_usuarios = Math.round(peopleVal(ee.n_usuarios));
    return ee;
  }).filter(function(e){
    return S.periodo==='all' || e.periodo_predominante===S.periodo;
  });
}

/* ── Metrics (só na aba Dígrafo) ──────────────────────────────────── */
function renderMetrics(){
  var m = RAW.metadata;
  var html = '';
  html += '<div class="mc"><div class="mc-lbl">Assinantes</div><div class="mc-val">'+fmtN(m.n_subscribers)+'</div><div class="mc-sub">'+m.n_days+' dias de janela</div></div>';
  html += '<div class="mc"><div class="mc-lbl">Antenas Anatel</div><div class="mc-val">'+fmtN(m.n_antenas)+'</div><div class="mc-sub">operadora: '+m.operadora+'</div></div>';
  html += '<div class="mc"><div class="mc-lbl">Clusters</div><div class="mc-val">'+m.n_clusters+'</div><div class="mc-sub">K-Means geográfico</div></div>';
  html += '<div class="mc"><div class="mc-lbl">Cidade</div><div class="mc-val" style="font-size:15px">'+RAW.cidade.nome+'</div><div class="mc-sub">'+RAW.cidade.uf+' · IBGE '+m.codigo_ibge+'</div></div>';
  document.getElementById('metrics').innerHTML = html;
}

/* ── Gráfico de linha genérico (multi-série, N dias) — reusado em
   Visão Geral (% por persona) e Sigma Topológico (Dígrafo/Jornada RG) ── */
function _multiLineChartSvg(dias, series, colors, opts){
  opts = opts || {};
  var W = opts.w || 860, H = opts.h || 200, padL = opts.padL || 40, padR = opts.padR || 10, padT = 12, padB = 22;
  var n = dias.length;
  var allVals = [];
  Object.keys(series).forEach(function(k){ series[k].forEach(function(v){ allVals.push(v); }); });
  var lo = opts.lo != null ? opts.lo : Math.min(0, Math.min.apply(null, allVals));
  var hi = opts.hi != null ? opts.hi : Math.max.apply(null, allVals) * 1.12;
  if(hi<=lo) hi = lo + 1;
  var x = function(i){ return padL + (W-padL-padR) * (n<=1?0:i/(n-1)); };
  var y = function(v){ return H-padB - (H-padT-padB) * ((v-lo)/(hi-lo)); };
  var fmtV = opts.fmtV || function(v){ return v.toFixed(1); };
  var svg = '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:'+H+'px;overflow:visible;">';
  svg += '<line x1="'+padL+'" y1="'+padT+'" x2="'+(W-padR)+'" y2="'+padT+'" stroke="#1A3050"/>';
  svg += '<text x="2" y="'+(padT+4)+'" font-size="9" fill="#3A6080">'+fmtV(hi)+'</text>';
  svg += '<line x1="'+padL+'" y1="'+(H-padB)+'" x2="'+(W-padR)+'" y2="'+(H-padB)+'" stroke="#1A3050"/>';
  svg += '<text x="2" y="'+(H-padB+3)+'" font-size="9" fill="#3A6080">'+fmtV(lo)+'</text>';
  dias.forEach(function(d,i){
    if(n<=10 || i%Math.ceil(n/10)===0 || i===n-1){
      svg += '<text x="'+x(i).toFixed(1)+'" y="'+(H-4)+'" font-size="8" fill="#3A6080" text-anchor="middle">'+d.slice(5)+'</text>';
    }
  });
  Object.keys(series).forEach(function(k){
    var vals = series[k];
    var pts = vals.map(function(v,i){ return x(i).toFixed(1)+','+y(v).toFixed(1); }).join(' ');
    var color = colors[k] || '#1E90FF';
    svg += '<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="1.8" opacity="0.92"/>';
    vals.forEach(function(v,i){
      svg += '<circle cx="'+x(i).toFixed(1)+'" cy="'+y(v).toFixed(1)+'" r="2.2" fill="'+color+'">'+
        '<title>'+k+' · '+dias[i]+': '+fmtV(v)+'</title></circle>';
    });
  });
  svg += '</svg>';
  return svg;
}

/* ── Visão Geral ──────────────────────────────────────────────────── */
function renderOverview(){
  var m = RAW.metadata;
  var html = '<div class="insights-grid">';

  if(RAW.personas_daily){
    var pdSeries = {}, pdColors = {};
    RAW.personas.forEach(function(p){
      pdSeries[p.id] = RAW.personas_daily.by_persona[p.id];
      pdColors[p.id] = '#'+p.cor_hex;
    });
    html += '<div class="ins-card" style="grid-column:1/-1;"><div class="ins-title">&#128200; % diário de pessoas por persona</div>'+
      _multiLineChartSvg(RAW.personas_daily.dias, pdSeries, pdColors, {fmtV:function(v){return v.toFixed(1)+'%';}, hi:25}) +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">'+
      RAW.personas.map(function(p){
        return '<span style="font-size:10.5px;color:#8ABEDF;display:inline-flex;align-items:center;gap:4px;">'+
          '<span style="width:8px;height:8px;border-radius:50%;background:#'+p.cor_hex+';display:inline-block;"></span>'+p.id+' '+p.nome+'</span>';
      }).join('') +
      '</div><div style="margin-top:6px;font-size:10.5px;color:#3A6080">'+(RAW.metadata.nota_personas_daily||'')+'</div></div>';
  }

  html += '<div class="ins-card"><div class="ins-title">&#128202; '+RAW.cidade.titulo+'</div>'+
    '<div class="ins-big">'+fmtN(m.n_subscribers)+'</div><div class="ins-sub">assinantes sintéticos · '+m.n_days+' dias · operadora '+m.operadora+'</div>'+
    '<div style="margin-top:10px;font-size:12px;color:#567898;">Antenas Anatel reais filtradas: <b style="color:#D0E8FF">'+fmtN(m.n_antenas)+'</b> · Clusters K-Means: <b style="color:#D0E8FF">'+m.n_clusters+'</b></div></div>';

  html += '<div class="ins-card"><div class="ins-title">&#128100; Distribuição de Personas</div>';
  RAW.personas.forEach(function(p){
    html += '<div class="ins-row"><span class="ins-row-label">'+p.id+' '+p.nome+'</span>'+
      '<div class="ins-bar-wrap"><div class="ins-bar-fill" style="width:'+p.pct+'%;background:#'+p.cor_hex+'"></div></div>'+
      '<span class="ins-val">'+p.pct+'%</span></div>';
  });
  html += '</div>';

  var topNodes = RAW.nodes.slice().sort(function(a,b){return b.n_usuarios-a.n_usuarios;}).slice(0,8);
  html += '<div class="ins-card"><div class="ins-title">&#127758; Clusters com mais assinantes</div>';
  topNodes.forEach(function(n){
    var pct = Math.round(100*n.n_usuarios/m.n_subscribers);
    html += '<div class="ins-row"><span class="ins-row-label">'+(n.area_nome||n.id)+' <span style="color:#567898">('+n.persona_dominante+' dominante)</span></span>'+
      '<div class="ins-bar-wrap"><div class="ins-bar-fill" style="width:'+pct+'%;background:#E87000"></div></div>'+
      '<span class="ins-val">'+fmtN(n.n_usuarios)+'</span></div>';
  });
  html += '</div>';

  html += '<div class="ins-card"><div class="ins-title">&#9888; Qualidade média (todas as personas)</div>';
  var avgDrop = d3.mean(RAW.quality_by_persona, function(d){return d.drop_medio;});
  var avgCong = d3.mean(RAW.quality_by_persona, function(d){return d.cong_medio;});
  var avgVoz  = d3.mean(RAW.quality_by_persona, function(d){return d.completamento_voz_medio;});
  html += '<div class="ins-row"><span class="ins-row-label">Taxa de drop média</span><span class="ins-val" style="color:'+(avgDrop>0.08?'#FF4444':'#2ECC71')+'">'+fmtPct(avgDrop)+'</span></div>';
  html += '<div class="ins-row"><span class="ins-row-label">Congestionamento médio</span><span class="ins-val">'+fmtPct(avgCong)+'</span></div>';
  html += '<div class="ins-row"><span class="ins-row-label">Completamento de voz médio</span><span class="ins-val">'+fmtPct(avgVoz)+'</span></div>';
  html += '<div style="margin-top:8px;font-size:11px;color:#3A6080">Fonte: CDR sintético determinístico (poc_personas_v2/pipeline), não RADIUS/IPFIX. Dados de demonstração — ver aba Assistente para metodologia.</div>';
  html += '</div>';

  html += '<div class="ins-card"><div class="ins-title">&#127772; Vamping (exposição noturna a telas)</div>'+
    '<div class="ins-big">'+RAW.vamping.resumo.score_medio+'<span style="font-size:16px;color:#567898">/100</span></div>'+
    '<div class="ins-sub">score médio · '+fmtPct(RAW.vamping.resumo.pct_flag/100)+' dos assinantes com uso frequente na madrugada (≥4 noites/semana) · p90 = '+RAW.vamping.resumo.p90+'</div>'+
    '<div style="margin-top:8px;font-size:11px;color:#3A6080">Indicador transversal (não é persona) — qualquer uma das 9 personas pode ter vamping alto ou baixo. Ver Personas ou Assistente para metodologia.</div></div>';

  html += '</div>';
  document.getElementById('overview-content').innerHTML = html;
}

/* ── Glossário ────────────────────────────────────────────────────── */
var GLOSSARIO = [
  {grupo:'Indicadores de qualidade', termo:'IPED', sigla:'Índice Ponderado de qualidade no DEslocamento', def:'Nota de 0 a 100 da qualidade de rede percebida ao longo de um trajeto (edge) entre dois clusters, combinando drop, congestionamento e completamento — mesma metodologia usada no StepGraph. Faixas: '+RAW.iped_faixas.map(function(f){return f.rotulo+' ('+f.valor_min+'–'+f.valor_max+')';}).join(', ')+'.'},
  {grupo:'Indicadores de qualidade', termo:'NQA', sigla:'Nível de Qualidade Aceitável', def:'Limiar de referência (linha tracejada amarela nos gráficos de Detecção CDR) acima do qual uma taxa observada (bloqueio, erro) é considerada estatisticamente fora do padrão aceitável, disparando alarme.'},
  {grupo:'Indicadores de qualidade', termo:'Vamping', sigla:null, def:'Indicador transversal (não é persona) de uso frequente do celular durante a madrugada (≥4 noites/semana) — proxy sintético de exposição noturna a telas.'},
  {grupo:'Indicadores de qualidade', termo:'RAT', sigla:'Radio Access Technology', def:'Tecnologia de acesso rádio dominante em um trajeto/antena (ex.: LTE, NR/5G).'},
  {grupo:'Indicadores de qualidade', termo:'ECGI', sigla:'E-UTRAN Cell Global Identifier', def:'Identificador global de uma célula/antena LTE — usado como chave das antenas Anatel reais na base de antenas deste app.'},
  {grupo:'Métodos estatísticos', termo:'MAD', sigla:'Median Absolute Deviation (Desvio Absoluto Mediano)', def:'Método robusto de detecção de outlier: em vez de média/desvio-padrão (sensíveis a valores extremos), usa a mediana da série e a mediana dos desvios absolutos à mediana. Score z robusto = 0,6745×(x−mediana)/MAD; |z|>3,5 é sinalizado como outlier. Usado na aba Outliers e como um dos sinais de score em Alertas por Rede.'},
  {grupo:'Métodos estatísticos', termo:'Cadeia de Markov', sigla:null, def:'Modelo em que o próximo estado (Normal/Atenção/Exceção/Crítico) depende só do estado atual, não do histórico completo. A "matriz de transição" mostra, para cada estado de origem, a probabilidade observada de ir para cada estado de destino — é uma estatística agregada sobre toda a janela de 15 dias, não algo que muda dia a dia (o que mudaria por dia seria o estado atual, não a matriz). Ver Alertas.'},
  {grupo:'Métodos estatísticos', termo:'Probabilidade posterior (Bayes)', sigla:null, def:'No cálculo Bayesiano ingênuo (prior × verossimilhança, normalizado) usado no Painel de Alertas, é a probabilidade recalculada de cada causa candidata depois de considerar a evidência observada. A "maior posterior" é simplesmente a causa com a probabilidade mais alta entre as candidatas — a explicação mais provável dado o que foi observado, não uma certeza.'},
  {grupo:'Métodos estatísticos', termo:'Sigma Index (Índice Sigma Topológico)', sigla:'σ(G)', def:'Índice topológico de grafo: σ(G) = Σ (grau(u) − grau(v))² somado sobre todas as arestas do grafo. Mede o quão heterogênea é a distribuição de grau — sobe quando o grafo tem hubs muito conectados ao lado de nós periféricos, desce quando os graus são parecidos. Calculado por dia nos gráficos de evolução do Dígrafo/Jornada RG.'},
  {grupo:'Métodos estatísticos', termo:'K-Means / K-Means++', sigla:null, def:'Algoritmo de clustering que agrupa antenas/assinantes em k grupos (clusters geográficos) minimizando a distância dentro de cada grupo. K-Means++ é uma variante com inicialização mais estável dos centróides.'},
  {grupo:'Alertas e priorização', termo:'Blast radius', sigla:null, def:'Contagem estimada de assinantes afetados a jusante (downstream) de um elemento de rede em falha/degradação, calculada dinamicamente a partir do rollup da topologia (Site→SGW→PGW→MME), não um limiar fixo predefinido.'},
  {grupo:'Alertas e priorização', termo:'Score de prioridade', sigla:null, def:'Combinação de gravidade técnica (estado Markov, MAD) e impacto de negócio (assinantes afetados, segmento de alto valor) em uma nota 0–100 usada para ordenar alertas por rede.'},
  {grupo:'Segmentação', termo:'Segmento', sigla:null, def:'Pós-pago, controle ou pré-pago — classificação comercial do assinante. Campo sintético (não vem do CDR real), gerado com pesos determinísticos por persona para viabilizar o filtro de Segmento.'},
  {grupo:'Segmentação', termo:'Persona', sigla:null, def:'Perfil comportamental do assinante (9 no total: '+RAW.personas.map(function(p){return p.id+' '+p.nome;}).join(', ')+') curado a partir de padrões reais de uso de rede — não pesquisa de mercado.'},
  {grupo:'Dados e escala', termo:'CDR', sigla:'Call Detail Record', def:'Registro detalhado de chamada/sessão (voz, dados, SMS) — a unidade bruta de dado de onde todas as métricas deste app são derivadas (sinteticamente, nesta demonstração).'},
  {grupo:'Dados e escala', termo:'Dispositivos × Pessoas', sigla:null, def:'Os números brutos do app (n_usuarios) representam dispositivos/linhas observadas. Para estimar pessoas reais, aplique pessoas = dispositivos × m% (market share da operadora) × c% (parcela de dispositivos não-IoT) × p% (penetração de celular na população) — configurável no toggle Dispositivos/Pessoas dos Filtros.'}
];
function renderGlossario(){
  var grupos = {};
  GLOSSARIO.forEach(function(g){ (grupos[g.grupo]=grupos[g.grupo]||[]).push(g); });
  var html = '<input type="text" class="gl-search" id="gl-search-input" placeholder="Buscar termo, sigla ou conceito...">';
  html += '<div id="gl-list">';
  Object.keys(grupos).forEach(function(grupo){
    html += '<div class="gl-group-title">'+grupo+'</div>';
    grupos[grupo].forEach(function(g){
      html += '<div class="gl-item" data-search="'+(g.termo+' '+(g.sigla||'')+' '+g.def).toLowerCase().replace(/"/g,'')+'">'+
        '<div class="gl-term">'+g.termo+(g.sigla?' <span class="gl-sigla">— '+g.sigla+'</span>':'')+'</div>'+
        '<div class="gl-def">'+g.def+'</div></div>';
    });
  });
  html += '</div>';
  document.getElementById('glossario-content').innerHTML = html;
  document.getElementById('gl-search-input').addEventListener('input', function(ev){
    var q = ev.target.value.toLowerCase();
    document.querySelectorAll('#gl-list .gl-item').forEach(function(it){
      it.classList.toggle('gl-hidden', q.length>0 && it.getAttribute('data-search').indexOf(q)===-1);
    });
  });
}

/* ── Dígrafo ──────────────────────────────────────────────────────── */
var _simulation = null;
function renderGraph(){
  var svg = d3.select('#graph-svg');
  svg.selectAll('*').remove();
  var el = document.getElementById('screen-graph');
  var w = el.clientWidth, h = el.clientHeight;
  svg.attr('viewBox', [0,0,w,h]);

  var nodes = _filteredNodesForDisplay();
  var nodeIds = {}; nodes.forEach(function(n){ nodeIds[n.id]=true; });
  var nodeById = {}; nodes.forEach(function(n){ nodeById[n.id]=n; });
  var edges = _filteredEdgesForDisplay(nodeIds)
    .filter(function(e){
      return (S.edgeMin==null || e.n_usuarios >= S.edgeMin) &&
             (S.edgeMax==null || e.n_usuarios <= S.edgeMax) &&
             (!e.iped_faixa || S.ipedFaixas[e.iped_faixa]) &&
             (S.personaFilter==='all' ||
               (nodeById[e.source] && nodeById[e.source].persona_dominante===S.personaFilter) ||
               (nodeById[e.target] && nodeById[e.target].persona_dominante===S.personaFilter));
    });

  var countEl = document.getElementById('edge-filter-count');
  if(countEl) countEl.textContent = fmtN(edges.length)+' de '+fmtN(RAW.edges.length)+' trajetos exibidos';

  var maxEdgeVol = d3.max(edges, function(e){return e.n_usuarios;}) || 1;
  var maxNodeVol = d3.max(nodes, function(n){return n.n_usuarios;}) || 1;
  var rScale = d3.scaleSqrt().domain([0,maxNodeVol]).range([4,26]);
  var wScale = d3.scaleLinear().domain([0,maxEdgeVol]).range([0.6,6]);

  // total de pessoas em arestas ligadas a cada nó (exibidas) — usado no
  // tooltip de aresta (% sobre o total do nó de origem) e no path builder
  var totalPorNo = {};
  edges.forEach(function(e){
    totalPorNo[e.source] = (totalPorNo[e.source]||0) + e.n_usuarios;
    totalPorNo[e.target] = (totalPorNo[e.target]||0) + e.n_usuarios;
  });
  var edgesByPair = {};
  edges.forEach(function(e){ edgesByPair[e.source+'|'+e.target]=e; edgesByPair[e.target+'|'+e.source]=e; });
  var degree = {};
  edges.forEach(function(e){ degree[e.source]=(degree[e.source]||0)+1; degree[e.target]=(degree[e.target]||0)+1; });

  var g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.3,4]).on('zoom', function(ev){ g.attr('transform', ev.transform); }));

  var link = g.append('g').selectAll('line').data(edges).enter().append('line')
    .attr('stroke', function(e){ return e.iped_cor ? '#'+e.iped_cor : '#2A4A6F'; })
    .attr('stroke-opacity', 0.75)
    .attr('stroke-width', function(e){ return wScale(e.n_usuarios); })
    .style('cursor', 'crosshair')
    .on('mouseover', function(ev,e){
      var tt = document.getElementById('edge-tooltip');
      // depois que a simulação inicia, d3.forceLink substitui e.source/e.target
      // (strings) por referências ao objeto do nó — normaliza para o id aqui
      var srcId = (e.source && typeof e.source==='object') ? e.source.id : e.source;
      var tgtId = (e.target && typeof e.target==='object') ? e.target.id : e.target;
      var pct = totalPorNo[srcId] ? (100*e.n_usuarios/totalPorNo[srcId]) : 0;
      tt.innerHTML = '<b>&#10010; '+(e.area_origem||srcId)+' &#8594; '+(e.area_destino||tgtId)+'</b><br>'+
        fmtN(e.n_usuarios)+' pessoas · '+fmtN(e.n_viagens)+' viagens<br>'+
        pct.toFixed(1)+'% do total de pessoas em trajetos ligados a '+(e.area_origem||srcId)+
        (e.iped!=null ? '<br>IPED: '+e.iped+' ('+e.iped_faixa+')' : '');
      tt.style.display='block';
      tt.style.left = (ev.offsetX+14)+'px'; tt.style.top=(ev.offsetY+10)+'px';
    })
    .on('mousemove', function(ev){
      var tt = document.getElementById('edge-tooltip');
      tt.style.left = (ev.offsetX+14)+'px'; tt.style.top=(ev.offsetY+10)+'px';
    })
    .on('mouseout', function(){ document.getElementById('edge-tooltip').style.display='none'; });

  var node = g.append('g').selectAll('circle').data(nodes).enter().append('circle')
    .attr('r', function(n){ return rScale(n.n_usuarios); })
    .attr('fill', function(n){ var p = PERSONA_MAP[n.persona_dominante]; return p ? '#'+p.cor_hex : '#567898'; })
    .attr('stroke', '#050C16').attr('stroke-width', 1.5)
    .attr('opacity', function(n){
      if(S.personaFilter==='all') return 1;
      return n.persona_dominante===S.personaFilter ? 1 : 0.15;
    })
    .style('cursor','pointer')
    .call(d3.drag()
      // Atualiza só o nó arrastado e as arestas ligadas a ele diretamente
      // no DOM — não reaquece a simulação de forças (alphaTarget/restart),
      // que faria os demais nós se reacomodarem/deslocarem junto. Os
      // outros nós ficam fixos; só o nó sob o mouse se move.
      .on('start', function(ev,d){ d.fx=d.x; d.fy=d.y; })
      .on('drag', function(ev,d){
        d.fx = ev.x; d.fy = ev.y;
        d.x = ev.x; d.y = ev.y;
        d3.select(this).attr('cx', d.x).attr('cy', d.y);
        label.filter(function(n){ return n===d; }).attr('x', d.x).attr('y', d.y);
        link.filter(function(e){ return e.source===d || e.target===d; })
            .attr('x1', function(e){return e.source.x;}).attr('y1', function(e){return e.source.y;})
            .attr('x2', function(e){return e.target.x;}).attr('y2', function(e){return e.target.y;});
      })
      .on('end', function(){ /* nó permanece fixo onde foi solto */ }))
    .on('click', function(ev,d){ _pbNodeClicked('graph', d.id); })
    .on('mouseover', function(ev,d){
      var tt = document.getElementById('tooltip');
      var mix = Object.keys(d.mix).map(function(k){return k+':'+d.mix[k];}).join(' · ');
      tt.innerHTML = '<b>'+d.id+' · '+(d.area_nome||'—')+'</b><br>'+fmtN(d.n_usuarios)+' assinantes<br>Dominante: '+d.persona_dominante+'<br>Mix: '+mix+
        '<br>Drop médio: '+fmtPct(d.drop_medio)+'<br>Download total: '+fmtN(Math.round(d.download_gb))+' GB'+
        (d.vamping_score!=null ? '<br>Vamping: '+d.vamping_score+'/100' : '');
      tt.style.display='block';
      tt.style.left = (ev.offsetX+14)+'px'; tt.style.top=(ev.offsetY+10)+'px';
    })
    .on('mousemove', function(ev){
      var tt = document.getElementById('tooltip');
      tt.style.left = (ev.offsetX+14)+'px'; tt.style.top=(ev.offsetY+10)+'px';
    })
    .on('mouseout', function(){ document.getElementById('tooltip').style.display='none'; });

  var label = g.append('g').selectAll('text').data(nodes).enter().append('text')
    .text(function(n){ return n.id.replace('CLUSTER_',''); })
    .attr('font-size', 9).attr('fill', '#8ABEDF').attr('text-anchor','middle').attr('dy', 3)
    .style('pointer-events','none');

  _simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(edges).id(function(n){return n.id;}).distance(70).strength(0.25))
    .force('charge', d3.forceManyBody().strength(-140))
    .force('center', d3.forceCenter(w/2, h/2))
    .force('collide', d3.forceCollide().radius(function(n){return rScale(n.n_usuarios)+4;}))
    // nós soltos (grau 0 nas arestas exibidas) recebem uma atração suave extra
    // para o centro, para não derivarem para longe do grafo principal
    .force('anchorX', d3.forceX(w/2).strength(function(n){ return degree[n.id] ? 0 : 0.10; }))
    .force('anchorY', d3.forceY(h/2).strength(function(n){ return degree[n.id] ? 0 : 0.10; }))
    .on('tick', function(){
      link.attr('x1',function(e){return e.source.x;}).attr('y1',function(e){return e.source.y;})
          .attr('x2',function(e){return e.target.x;}).attr('y2',function(e){return e.target.y;});
      node.attr('cx',function(n){return n.x;}).attr('cy',function(n){return n.y;});
      label.attr('x',function(n){return n.x;}).attr('y',function(n){return n.y;});
    });

  S._pbCtx = S._pbCtx || {};
  S._pbCtx.graph = {
    edgesByPair: edgesByPair,
    totalSaida: totalPorNo,
    totalSubscribers: d3.sum(nodes, function(n){ return n.n_usuarios; }),
    nodeLabel: function(id){ var n = nodeById[id]; return n ? (n.area_nome||id) : id; }
  };
  _pbRender('graph');

  _renderSigmaChart('sigma-chart-graph');
}

/* ── Sigma Topológico diário — σ(G) = Σ (deg(u)−deg(v))² sobre as
   arestas, usando grau PONDERADO pelo tráfego diário de cada aresta
   (grau simples não mudaria dia a dia, pois a topologia é fixa — só o
   peso das arestas varia por dia). Calculado sobre RAW.edges/nodes
   completos, independente dos filtros de tela, como um indicador de
   tendência estável. ─────────────────────────────────────────────── */
var _sigmaSeriesCache = null;
function _sigmaSeriesDaily(){
  if(_sigmaSeriesCache) return _sigmaSeriesCache;
  var dias = (RAW.personas_daily && RAW.personas_daily.dias) || [];
  var values = dias.map(function(_,d){
    var degW = {};
    RAW.edges.forEach(function(e){
      var v = e.daily ? e.daily.n_usuarios[d] : e.n_usuarios;
      degW[e.source] = (degW[e.source]||0) + v;
      degW[e.target] = (degW[e.target]||0) + v;
    });
    var sigma = 0;
    RAW.edges.forEach(function(e){
      var diff = (degW[e.source]||0) - (degW[e.target]||0);
      sigma += diff*diff;
    });
    return sigma;
  });
  _sigmaSeriesCache = {dias:dias, values:values};
  return _sigmaSeriesCache;
}
function _renderSigmaChart(elId){
  var el = document.getElementById(elId);
  if(!el || !RAW.personas_daily) return;
  var s = _sigmaSeriesDaily();
  el.innerHTML = _multiLineChartSvg(s.dias, {'σ(G)': s.values}, {'σ(G)':'#E87000'},
    {h:90, padL:34, fmtV: function(v){ return v>=1e6 ? (v/1e6).toFixed(1)+'M' : v>=1e3 ? (v/1e3).toFixed(0)+'k' : v.toFixed(0); }});
}

/* ── Path builder — clique em nós contíguos monta um caminho; mostra
   pessoas/% por aresta e uma estimativa de pessoas distintas no
   percurso todo (aproximação: mínimo entre os pesos das arestas do
   caminho, análogo ao gargalo de um fluxo — não há rastro individual
   de assinante por trajeto nos dados agregados). Compartilhado entre
   Dígrafo e Jornada RG (screenKey 'graph' / 'rgjourney'). ──────────── */
Object.assign(S, { path: {graph:[], rgjourney:[]} });
function _pbEdgeLookup(edgesByPair, a, b){ return edgesByPair[a+'|'+b] || edgesByPair[b+'|'+a] || null; }
function _pbNodeClicked(screenKey, nodeId){
  var ctx = S._pbCtx && S._pbCtx[screenKey];
  if(!ctx) return;
  var path = S.path[screenKey];
  if(path.length && path[path.length-1]===nodeId) return;
  if(path.length===0 || _pbEdgeLookup(ctx.edgesByPair, path[path.length-1], nodeId)){
    path.push(nodeId);
  } else {
    S.path[screenKey] = [nodeId];
  }
  _pbRender(screenKey);
}
function _pbClear(screenKey){ S.path[screenKey] = []; _pbRender(screenKey); }
function _pbRender(screenKey){
  var contentId = screenKey==='graph' ? 'path-builder-content-graph' : 'path-builder-content-rgjourney';
  var el = document.getElementById(contentId);
  if(!el) return;
  var path = S.path[screenKey] || [];
  var ctx = S._pbCtx && S._pbCtx[screenKey];
  if(!path.length || !ctx){
    el.innerHTML = '<div class="pb-hint">Clique em nós contíguos (ligados por uma aresta) para montar um caminho.</div>';
    return;
  }
  var html = '<div class="pb-step"><b>1. '+ctx.nodeLabel(path[0])+'</b></div>';
  var edgeVals = [];
  for(var i=1;i<path.length;i++){
    var e = _pbEdgeLookup(ctx.edgesByPair, path[i-1], path[i]);
    if(!e){ html += '<div class="pb-step" style="color:#FF6B5B;">(sem aresta direta)</div>'; continue; }
    edgeVals.push(e.n_usuarios);
    var tot = ctx.totalSaida[path[i-1]] || e.n_usuarios;
    var pct = 100*e.n_usuarios/tot;
    html += '<div class="pb-step" style="color:#8ABEDF;">&#8627; '+fmtN(e.n_usuarios)+' pessoas · '+pct.toFixed(1)+'%</div>';
    html += '<div class="pb-step"><b>'+(i+1)+'. '+ctx.nodeLabel(path[i])+'</b></div>';
  }
  if(edgeVals.length){
    var distinctApprox = Math.min.apply(null, edgeVals);
    var pctDistinct = 100*distinctApprox/(ctx.totalSubscribers||1);
    html += '<div class="pb-total">Pessoas distintas no percurso (aproximado — limite pelo gargalo do caminho): <b>'+fmtN(distinctApprox)+'</b> ('+pctDistinct.toFixed(1)+'%)</div>';
  }
  el.innerHTML = html;
}

/* ── Mapa (Leaflet, coordenadas reais das antenas/clusters) ──────── */
var _leafletMap = null;
function renderMap(){
  var el = document.getElementById('map-leaflet');
  if(!_leafletMap){
    _leafletMap = L.map(el, { zoomControl: true }).setView(RAW.cidade.centro, RAW.cidade.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap'
    }).addTo(_leafletMap);
    _leafletMap._edgeLayer = L.layerGroup().addTo(_leafletMap);
    _leafletMap._clusterLayer = L.layerGroup().addTo(_leafletMap);
    _leafletMap._antenaLayer = L.layerGroup(); // não adiciona ainda — só via toggle
    _leafletMap.on('click', _geoOnMapClick);
  } else {
    _leafletMap._edgeLayer.clearLayers();
    _leafletMap._clusterLayer.clearLayers();
  }

  if(_leafletMap._antenaLayer.getLayers().length === 0){
    RAW.antenas.forEach(function(a){
      var m = L.circleMarker([a.lat, a.lon], {
        radius: 2.5, color: '#8ABEDF', weight: 1, fillColor: '#5AC8FA', fillOpacity: 0.6
      });
      m.bindPopup(
        '<div class="map-popup-title">&#128225; '+a.ecgi+'</div>'+
        '<div class="map-popup-row">Cluster: '+a.cluster+'</div>'+
        '<div class="map-popup-row">Tecnologia: '+a.tecnologia+'</div>'+
        '<div class="map-popup-row">Altura: '+(a.altura_m!=null?a.altura_m+' m':'—')+' · Azimute: '+(a.azimute_graus!=null?a.azimute_graus+'°':'—')+'</div>',
        { className: 'map-leaflet-tip' }
      );
      m.addTo(_leafletMap._antenaLayer);
    });
  }
  document.getElementById('map-antenas-count').textContent = fmtN(RAW.antenas.length);
  var toggle = document.getElementById('map-antenas-toggle');
  if(!toggle._wired){
    toggle._wired = true;
    toggle.addEventListener('change', function(){
      if(toggle.checked) _leafletMap._antenaLayer.addTo(_leafletMap);
      else _leafletMap.removeLayer(_leafletMap._antenaLayer);
    });
  }
  if(toggle.checked && !_leafletMap.hasLayer(_leafletMap._antenaLayer)) _leafletMap._antenaLayer.addTo(_leafletMap);

  var vTog = document.getElementById('map-voronoi-toggle');
  var vSel = document.getElementById('voronoi-indicador');
  if(!vTog._wired){
    vTog._wired = true;
    vTog.addEventListener('change', function(){
      document.getElementById('voronoi-options').style.display = vTog.checked ? 'block' : 'none';
      if(vTog.checked) _voronoiRender(vSel.value);
      else if(_leafletMap._voronoiLayer) _leafletMap.removeLayer(_leafletMap._voronoiLayer);
    });
    vSel.addEventListener('change', function(){ if(vTog.checked) _voronoiRender(vSel.value); });
  }
  if(vTog.checked) _voronoiRender(vSel.value);

  var nodesF = _filteredNodesForDisplay()
    .filter(function(n){ return S.personaFilter==='all' || n.persona_dominante===S.personaFilter; })
    .filter(function(n){ return (S.nodeMin==null || n.n_usuarios>=S.nodeMin) && (S.nodeMax==null || n.n_usuarios<=S.nodeMax); });
  var nodeIds = {}; nodesF.forEach(function(n){ nodeIds[n.id]=true; });
  var nodeById = {}; nodesF.forEach(function(n){ nodeById[n.id] = n; });
  var totalExibido = d3.sum(nodesF, function(n){ return n.n_usuarios; }) || 1;

  var edgesF = _filteredEdgesForDisplay(nodeIds)
    .filter(function(e){
      return (S.edgeMin==null || e.n_usuarios>=S.edgeMin) && (S.edgeMax==null || e.n_usuarios<=S.edgeMax) &&
        (!e.iped_faixa || S.ipedFaixas[e.iped_faixa]) &&
        (S.personaFilter==='all' ||
          (nodeById[e.source] && nodeById[e.source].persona_dominante===S.personaFilter) ||
          (nodeById[e.target] && nodeById[e.target].persona_dominante===S.personaFilter));
    });
  // total que parte de cada node de origem (dentre as arestas exibidas), para % de partida por aresta
  var totalSaidaPorNode = {};
  edgesF.forEach(function(e){ totalSaidaPorNode[e.source] = (totalSaidaPorNode[e.source]||0) + e.n_usuarios; });

  // Trajetos (arestas) — mesma origem de dado do Dígrafo (RAW.edges),
  // mas desenhados nas coordenadas geográficas reais em vez do layout de
  // forças. Espessura proporcional ao nº de assinantes que se deslocaram.
  var maxEdgeVol = d3.max(edgesF, function(e){return e.n_usuarios;}) || 1;
  var edgeWeight = d3.scaleLinear().domain([0, maxEdgeVol]).range([1, 9]);
  edgesF.forEach(function(e){
    var a = nodeById[e.source], b = nodeById[e.target];
    if(!a || !b || a.lat==null || b.lat==null) return;
    var cor = e.iped_cor ? '#'+e.iped_cor : '#E87000';
    var line = L.polyline([[a.lat,a.lon],[b.lat,b.lon]], {
      color: cor,
      weight: edgeWeight(e.n_usuarios),
      opacity: 0.65
    });
    var pctPartida = totalSaidaPorNode[e.source] ? (100*e.n_usuarios/totalSaidaPorNode[e.source]) : 0;
    line.bindPopup(
      '<div class="map-popup-title">'+(e.area_origem||a.id)+' &#8594; '+(e.area_destino||b.id)+'</div>'+
      '<div class="map-popup-row">'+fmtN(e.n_usuarios)+' assinantes deslocados ('+pctPartida.toFixed(1)+'% do que parte de '+(e.area_origem||a.id)+') · '+fmtN(e.n_viagens)+' viagens</div>'+
      '<div class="map-popup-row">Distância média: '+e.dist_km+' km · período predominante: '+e.periodo_predominante+'</div>'+
      '<div class="map-popup-row">RAT dominante: '+e.rat_dominante+'</div>'+
      (e.iped!=null ? '<div class="map-popup-row"><b>IPED: '+e.iped+' — '+e.iped_faixa+'</b> (qualidade no deslocamento)</div>' : ''),
      { className: 'map-leaflet-tip' }
    );
    line.on('mouseover', function(){ line.setStyle({opacity:0.95, weight: edgeWeight(e.n_usuarios)+2}); });
    line.on('mouseout', function(){ line.setStyle({opacity:0.65, weight: edgeWeight(e.n_usuarios)}); });
    line.addTo(_leafletMap._edgeLayer);
  });

  var maxVol = d3.max(nodesF, function(n){return n.n_usuarios;}) || 1;
  var rScale = d3.scaleSqrt().domain([0,maxVol]).range([5,32]);

  nodesF.forEach(function(n){
    if(n.lat==null || n.lon==null) return;
    var p = PERSONA_MAP[n.persona_dominante];
    var color = p ? '#'+p.cor_hex : '#567898';
    var marker = L.circleMarker([n.lat, n.lon], {
      radius: rScale(n.n_usuarios),
      color: '#050C16', weight: 1.5,
      fillColor: color, fillOpacity: 0.75
    });
    var mix = Object.keys(n.mix).map(function(k){ var pk=PERSONA_MAP[k]; return (pk?pk.id+' '+pk.nome:k)+': '+fmtN(n.mix[k]); }).join('<br>');
    var pctConcentrado = 100*n.n_usuarios/totalExibido;
    marker.bindPopup(
      '<div class="map-popup-title">'+n.id+' · '+(n.area_nome||'Região não identificada')+'</div>'+
      '<div class="map-popup-row">'+fmtN(n.n_usuarios)+' assinantes ('+pctConcentrado.toFixed(1)+'% do total exibido) · dominante: '+(p?p.id+' '+p.nome:n.persona_dominante)+'</div>'+
      '<div class="map-popup-row">'+mix+'</div>'+
      '<div class="map-popup-row">Drop médio: '+fmtPct(n.drop_medio)+' · Download: '+fmtN(Math.round(n.download_gb))+' GB</div>'+
      (n.vamping_score!=null ? '<div class="map-popup-row">Vamping: '+n.vamping_score+'/100 ('+n.vamping_pct_flag+'% com uso frequente na madrugada)</div>' : ''),
      { className: 'map-leaflet-tip' }
    );
    marker.addTo(_leafletMap._clusterLayer);
  });

  if(!_leafletMap._geoSavedLayer) _geoRenderSaved();
  _geoUpdateUI();
  setTimeout(function(){ _leafletMap.invalidateSize(); }, 80);
}

/* ── Voronoi — divide a área em células a partir das antenas reais
   (d3.Delaunay, já incluso no bundle completo do D3), recortado pela
   bounding box da cidade. O pipeline (00_preparar_antenas_anatel.py)
   já tinha um stub para isso (calcular_voronoi_simples) que nunca
   chegou a gerar o WKT completo — calculamos aqui no navegador, sobre
   os dados já carregados, em vez de terminar aquele stub em Python.

   Assinantes (quantidade extensiva) é distribuído proporcionalmente
   pela área da célula dentro do cluster K-Means da antena — dá uma
   estimativa de densidade mais suave que repetir o valor do cluster
   em toda antena. Os demais indicadores (drop/congestionamento/
   download/vamping) são taxas/agregados por cluster, não medidos por
   antena individual — herdados do cluster sem redistribuição, e o
   tooltip deixa isso explícito. ─────────────────────────────────── */
var _voronoiCells = null;

function _voronoiCompute(){
  if(_voronoiCells) return _voronoiCells;
  var bb = RAW.cidade.bbox;

  // Muitas antenas compartilham a mesma lat/lon exata (setores/bandas
  // diferentes da mesma torre física — comum no cadastro Anatel).
  // Delaunay/Voronoi não gera célula para pontos coincidentes, então
  // agrupamos por site físico antes de triangular — 1 célula por
  // localização real, não por linha do CSV.
  var porSite = {};
  RAW.antenas.forEach(function(a){
    var key = a.lat.toFixed(6) + ',' + a.lon.toFixed(6);
    if(!porSite[key]) porSite[key] = { lat: a.lat, lon: a.lon, cluster: a.cluster, ecgis: [] };
    porSite[key].ecgis.push(a.ecgi);
  });
  var sites = Object.keys(porSite).map(function(k){ return porSite[k]; });

  var points = sites.map(function(s){ return [s.lon, s.lat]; });
  var delaunay = d3.Delaunay.from(points);
  var voronoi = delaunay.voronoi([bb.lonLeft, bb.latBottom, bb.lonRight, bb.latTop]);

  var nodeById = {};
  RAW.nodes.forEach(function(n){ nodeById[n.id] = n; });

  var areaPorCluster = {};
  var brutas = sites.map(function(s, i){
    var poly = voronoi.cellPolygon(i);
    if(!poly) return null;
    var area = Math.abs(d3.polygonArea(poly));
    areaPorCluster[s.cluster] = (areaPorCluster[s.cluster] || 0) + area;
    return { site: s, poly: poly, area: area };
  });

  _voronoiCells = brutas.filter(Boolean).map(function(c){
    var node = nodeById[c.site.cluster];
    var totalArea = areaPorCluster[c.site.cluster] || 1;
    var fracao = c.area / totalArea;
    var nSetores = c.site.ecgis.length;
    return {
      ecgi: c.site.ecgis[0] + (nSetores > 1 ? ' (site com ' + nSetores + ' setores)' : ''),
      cluster: c.site.cluster,
      latlon: c.poly.map(function(p){ return [p[1], p[0]]; }),
      n_usuarios: node ? node.n_usuarios * fracao : 0,
      drop_medio: node ? node.drop_medio : null,
      cong_medio: node ? node.cong_medio : null,
      download_gb: node ? node.download_gb : null,
      vamping_score: node ? node.vamping_score : null,
    };
  });
  return _voronoiCells;
}

var VORONOI_META = {
  n_usuarios:   { label: 'Assinantes (estimado por área)', fmt: function(v){ return fmtN(Math.round(v)); }, extensivo: true },
  drop_medio:   { label: 'Drop médio',            fmt: fmtPct, extensivo: false },
  cong_medio:   { label: 'Congestionamento',      fmt: fmtPct, extensivo: false },
  download_gb:  { label: 'Download total (GB)',   fmt: function(v){ return fmtN(Math.round(v)); }, extensivo: false },
  vamping_score:{ label: 'Vamping',               fmt: function(v){ return v!=null ? v.toFixed(1)+'/100' : '—'; }, extensivo: false },
};

function _voronoiRender(indicador){
  var cells = _voronoiCompute();
  var meta = VORONOI_META[indicador];
  var vals = cells.map(function(c){ return c[indicador]; }).filter(function(v){ return v!=null; });
  var lo = d3.min(vals), hi = d3.max(vals);
  var colorScale = d3.scaleLinear().domain([lo, hi]).range(['#1E3A5F', '#E87000']).clamp(true);

  if(_leafletMap._voronoiLayer) _leafletMap.removeLayer(_leafletMap._voronoiLayer);
  if(!_leafletMap._voronoiRenderer) _leafletMap._voronoiRenderer = L.canvas();
  var layer = L.layerGroup();

  cells.forEach(function(c){
    var v = c[indicador];
    var color = v != null ? colorScale(v) : '#333';
    var poly = L.polygon(c.latlon, {
      renderer: _leafletMap._voronoiRenderer,
      color: '#0A1422', weight: 0.5, fillColor: color, fillOpacity: 0.55
    });
    var origem = meta.extensivo
      ? 'estimado por área dentro do cluster ' + c.cluster
      : 'herdado do cluster ' + c.cluster + ' — não medido por antena individual';
    poly.bindTooltip(
      '<b>' + c.ecgi + '</b><br>' + meta.label + ': ' + (v != null ? meta.fmt(v) : '—') +
      '<br><span style="font-size:10px;color:#64748B">' + origem + '</span>',
      { sticky: true }
    );
    poly.addTo(layer);
  });
  layer.addTo(_leafletMap);
  _leafletMap._voronoiLayer = layer;

  var legend = document.getElementById('voronoi-legend');
  if(legend){
    legend.innerHTML = meta.label + '<br>' +
      '<div style="display:flex;align-items:center;gap:4px;margin-top:3px;">' +
      '<span>' + (lo != null ? meta.fmt(lo) : '—') + '</span>' +
      '<div style="flex:1;height:6px;background:linear-gradient(90deg,#1E3A5F,#E87000);border-radius:3px;"></div>' +
      '<span>' + (hi != null ? meta.fmt(hi) : '—') + '</span></div>';
  }
}

/* ── Geofence — desenhar e nomear cluster customizado no Mapa
   (mesmo padrão do StepGraph real: mapa-rm/src/App.jsx — clique a
   clique, ponto-em-poligono, nomeia ao atingir 3+ vértices). Como o
   CDR aqui não tem lat/lon por assinante, a agregação de estatísticas
   do geofence é feita pelos CLUSTERS K-Means cujas antenas caem dentro
   do polígono desenhado — aproximação explícita, não um recálculo do
   CDR bruto por geofence. ──────────────────────────────────────────── */
var _geoDrawing = false;
var _geoCurrentPoly = [];
var _geoCustomClusters = [];
var _geoPreviewLayer = null;
var _geoVertexLayer = null;

function _pointInPoly(lat, lon, poly){
  var inside = false;
  for(var i=0, j=poly.length-1; i<poly.length; j=i++){
    var yi=poly[i][0], xi=poly[i][1], yj=poly[j][0], xj=poly[j][1];
    var intersect = ((yi>lat) !== (yj>lat)) && (lon < (xj-xi)*(lat-yi)/(yj-yi)+xi);
    if(intersect) inside = !inside;
  }
  return inside;
}
function _geoOnMapClick(e){
  if(!_geoDrawing) return;
  _geoCurrentPoly.push([e.latlng.lat, e.latlng.lng]);
  _geoRedrawPreview();
  _geoUpdateUI();
}
function _geoStartDrawing(){
  _geoDrawing = true;
  _geoCurrentPoly = [];
  _leafletMap.getContainer().style.cursor = 'crosshair';
  _geoUpdateUI();
}
function _geoCancelDrawing(){
  _geoDrawing = false;
  _geoCurrentPoly = [];
  if(_geoPreviewLayer){ _leafletMap.removeLayer(_geoPreviewLayer); _geoPreviewLayer=null; }
  if(_geoVertexLayer){ _leafletMap.removeLayer(_geoVertexLayer); _geoVertexLayer=null; }
  _leafletMap.getContainer().style.cursor = '';
  _geoUpdateUI();
}
function _geoUndoPoint(){
  _geoCurrentPoly.pop();
  _geoRedrawPreview();
  _geoUpdateUI();
}
function _geoRedrawPreview(){
  if(_geoPreviewLayer){ _leafletMap.removeLayer(_geoPreviewLayer); _geoPreviewLayer=null; }
  if(_geoVertexLayer){ _leafletMap.removeLayer(_geoVertexLayer); _geoVertexLayer=null; }
  if(_geoCurrentPoly.length===0) return;
  if(_geoCurrentPoly.length>=2){
    _geoPreviewLayer = L.polygon(_geoCurrentPoly, {color:'#A855F7', weight:2, dashArray:'6 4', fillOpacity:0.15}).addTo(_leafletMap);
  }
  _geoVertexLayer = L.layerGroup(_geoCurrentPoly.map(function(p){
    return L.circleMarker(p, {radius:4, color:'#A855F7', fillColor:'#A855F7', fillOpacity:1});
  })).addTo(_leafletMap);
}
function _geoFinalizarFromInput(){
  var inp = document.getElementById('geo-nome-input');
  if(inp) _geoFinalizar(inp.value);
}
function _geoFinalizar(nome){
  nome = (nome||'').trim();
  if(_geoCurrentPoly.length < 3 || !nome) return;
  var poly = _geoCurrentPoly.slice();
  var antenasDentro = RAW.antenas.filter(function(a){ return _pointInPoly(a.lat, a.lon, poly); });
  var clustersTocados = {};
  antenasDentro.forEach(function(a){ clustersTocados[a.cluster] = (clustersTocados[a.cluster]||0)+1; });
  var nodesTocados = RAW.nodes.filter(function(n){ return clustersTocados[n.id]; });

  var mix = {};
  nodesTocados.forEach(function(n){
    Object.keys(n.mix).forEach(function(k){ mix[k] = (mix[k]||0) + n.mix[k]; });
  });

  var geo = {
    id: 'GEO_' + Date.now(),
    nome: nome,
    polygon: poly,
    n_antenas: antenasDentro.length,
    n_clusters_tocados: Object.keys(clustersTocados).length,
    n_usuarios: d3.sum(nodesTocados, function(n){return n.n_usuarios;}),
    drop_medio: nodesTocados.length ? d3.mean(nodesTocados, function(n){return n.drop_medio;}) : null,
    cong_medio: nodesTocados.length ? d3.mean(nodesTocados, function(n){return n.cong_medio;}) : null,
    vamping_score: nodesTocados.length ? d3.mean(nodesTocados, function(n){return n.vamping_score;}) : null,
    mix: mix,
  };
  _geoCustomClusters.push(geo);
  _geoCancelDrawing();
  _geoRenderSaved();
}
function _geoDelete(id){
  _geoCustomClusters = _geoCustomClusters.filter(function(g){ return g.id !== id; });
  _geoRenderSaved();
  _geoUpdateUI();
}
function _geoFocus(id){
  var g = _geoCustomClusters.filter(function(x){return x.id===id;})[0];
  if(g) _leafletMap.fitBounds(L.polygon(g.polygon).getBounds());
}
function _geoRenderSaved(){
  if(!_leafletMap._geoSavedLayer) _leafletMap._geoSavedLayer = L.layerGroup().addTo(_leafletMap);
  _leafletMap._geoSavedLayer.clearLayers();
  _geoCustomClusters.forEach(function(geo){
    var poly = L.polygon(geo.polygon, {color:'#A855F7', weight:2, dashArray:'6 4', fillColor:'#A855F7', fillOpacity:0.12});
    var mixText = Object.keys(geo.mix).map(function(k){return k+': '+fmtN(geo.mix[k]);}).join('<br>');
    poly.bindPopup(
      '<div class="map-popup-title">&#9733; '+geo.nome+'</div>'+
      '<div class="map-popup-row">'+fmtN(geo.n_antenas)+' antenas · '+geo.n_clusters_tocados+' cluster(s) tocado(s)</div>'+
      '<div class="map-popup-row">~'+fmtN(geo.n_usuarios)+' assinantes (soma dos clusters tocados)</div>'+
      (geo.drop_medio!=null ? '<div class="map-popup-row">Drop médio: '+fmtPct(geo.drop_medio)+' · Vamping: '+geo.vamping_score.toFixed(1)+'/100</div>' : '')+
      (mixText ? '<div class="map-popup-row">'+mixText+'</div>' : '')+
      '<div class="map-popup-row" style="font-size:10px;color:#64748B;margin-top:4px">Aproximação: agrega os clusters K-Means cujas antenas caem dentro do polígono — não é um recálculo do CDR bruto por geofence.</div>',
      { className: 'map-leaflet-tip' }
    );
    poly.addTo(_leafletMap._geoSavedLayer);
  });
}
function _geoUpdateUI(){
  var el = document.getElementById('geo-draw-panel');
  if(!el) return;
  var html = '';
  if(!_geoDrawing){
    html += '<button class="fbtn" onclick="_geoStartDrawing()" style="text-align:center;width:100%">&#9998; Novo Cluster (Geofence)</button>';
  } else {
    html += '<div style="font-size:11px;color:#8ABEDF;margin-top:2px">Clique no mapa para adicionar vértices: <b style="color:#D0E8FF">'+_geoCurrentPoly.length+'</b></div>';
    html += '<div style="display:flex;gap:4px;margin-top:6px">';
    html += '<button class="fbtn" onclick="_geoUndoPoint()" style="flex:1;text-align:center" '+(_geoCurrentPoly.length===0?'disabled':'')+'>&#8617; Desfazer</button>';
    html += '<button class="fbtn" onclick="_geoCancelDrawing()" style="flex:1;text-align:center">&#10005; Cancelar</button>';
    html += '</div>';
    if(_geoCurrentPoly.length >= 3){
      html += '<div style="margin-top:8px;font-size:11px;color:#2ECC71">&#10003; Pronto para nomear!</div>';
      html += '<input type="text" id="geo-nome-input" class="sva-num-input" placeholder="Ex: Zona Norte Expandida" style="width:100%;margin-top:4px;box-sizing:border-box" onkeydown="if(event.key===\'Enter\')_geoFinalizarFromInput()">';
      html += '<button class="fbtn" onclick="_geoFinalizarFromInput()" style="text-align:center;margin-top:6px;width:100%;background:#7C3AED;border-color:#7C3AED;color:#fff">&#10003; Criar</button>';
    } else {
      html += '<div style="font-size:10px;color:#3A6080;margin-top:4px">Mínimo de 3 vértices para nomear.</div>';
    }
  }
  if(_geoCustomClusters.length){
    html += '<div style="font-size:10px;color:#567898;margin-top:12px;text-transform:uppercase;letter-spacing:.05em">Clusters criados</div>';
    _geoCustomClusters.forEach(function(g){
      html += '<div style="display:flex;align-items:center;gap:4px;margin-top:5px;font-size:11px;color:#D0E8FF">'+
        '<span style="flex:1;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" onclick="_geoFocus(\''+g.id+'\')" title="'+g.nome+'">&#9733; '+g.nome+'</span>'+
        '<span style="color:#567898;flex-shrink:0">'+g.n_antenas+' ant.</span>'+
        '<button onclick="_geoDelete(\''+g.id+'\')" style="background:none;border:none;color:#FF6B5B;cursor:pointer;font-size:12px;flex-shrink:0" title="Excluir">&#10005;</button></div>';
    });
  }
  el.innerHTML = html;
}

/* ── Jornada RG (dígrafo de categorias de serviço, equivalente ao
   SVA→SVA do JourneyGraph ISP — as personas/taxonomia de banda larga
   fixa não se aplicam ao domínio móvel, então o RG do CDR móvel faz
   esse papel) ──────────────────────────────────────────────────── */
var RG_COLOR = {
  STREAMING:'#E87000', GAMING:'#7C3AED', SOCIAL:'#2ECC71',
  COMUNICACAO:'#1E90FF', VPN:'#FF4444', OUTROS:'#567898'
};
var RG_LABEL = {
  STREAMING:'Streaming', GAMING:'Gaming', SOCIAL:'Social',
  COMUNICACAO:'Comunicação', VPN:'VPN/Corporativo', OUTROS:'Outros'
};
var RG_ORDER = ['STREAMING','GAMING','SOCIAL','COMUNICACAO','VPN','OUTROS'];

function renderRGJourney(){
  var jr = RAW.jornada_rg;
  var data = (S.personaFilter!=='all' && jr.by_persona[S.personaFilter]) ? jr.by_persona[S.personaFilter] : {nodes: jr.nodes, edges: jr.edges};

  var wrap = document.getElementById('rgjourney-content');
  wrap.innerHTML = '<div id="rgj-svg-wrap" style="position:relative;"><svg id="rgj-svg" viewBox="0 0 560 480"></svg>'+
    '<div class="sigma-chart-panel"><div class="sigma-chart-title">&#963; Topológico (evolução diária)</div><div id="sigma-chart-rgj"></div></div>'+
    '<div class="pb-box"><div class="pb-title">Construtor de caminho</div><div id="path-builder-content-rgjourney"></div><button class="pb-clear-btn" onclick="_pbClear(\'rgjourney\')">Limpar caminho</button></div>'+
    '</div><div class="rgj-side" id="rgj-side"></div>';

  var svg = d3.select('#rgj-svg');
  var g = svg.append('g').attr('class', 'rgj-zoom-group');
  svg.call(d3.zoom().scaleExtent([0.5, 3]).on('zoom', function(ev){ g.attr('transform', ev.transform); }));
  svg = g; // daqui pra baixo, todo append() vai dentro do grupo zoomável

  var cx=280, cy=230, R=170;
  var nodeById = {};
  data.nodes.forEach(function(n,i){
    var ang = -Math.PI/2 + i*(2*Math.PI/RG_ORDER.length);
    nodeById[n.id] = { id:n.id, n:n.n, x: cx+R*Math.cos(ang), y: cy+R*Math.sin(ang) };
  });

  var maxN = d3.max(data.nodes, function(n){return n.n;}) || 1;
  var rNode = d3.scaleSqrt().domain([0,maxN]).range([16,40]);
  var maxE = d3.max(data.edges, function(e){return e.n;}) || 1;
  var wEdge = d3.scaleLinear().domain([0,maxE]).range([1,7]);

  svg.append('defs').append('marker')
    .attr('id','rgj-arrow').attr('viewBox','0 -5 10 10').attr('refX',14).attr('refY',0)
    .attr('markerWidth',6).attr('markerHeight',6).attr('orient','auto')
    .append('path').attr('d','M0,-5L10,0L0,5').attr('fill','#8ABEDF');

  // Arestas curvas (offset perpendicular) para separar visualmente A→B de B→A
  function _rgjEdgeD(a, b){
    var dx=b.x-a.x, dy=b.y-a.y, dist=Math.sqrt(dx*dx+dy*dy) || 1;
    var mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    var offset = 18;
    var nx=-dy/dist*offset, ny=dx/dist*offset;
    return 'M'+a.x+','+a.y+' Q'+(mx+nx)+','+(my+ny)+' '+b.x+','+b.y;
  }
  data.edges.forEach(function(e){
    var a = nodeById[e.source], b = nodeById[e.target];
    if(!a || !b) return;
    var pathD = _rgjEdgeD(a, b);
    var ratio = e.n/maxE;
    var baseOpacity = 0.25+ratio*0.55;
    var path = svg.append('path').attr('d', pathD).attr('fill','none')
      .attr('class','rgj-edge')
      .attr('data-source', e.source).attr('data-target', e.target)
      .attr('stroke', RG_COLOR[e.source]).attr('stroke-width', wEdge(e.n))
      .attr('stroke-opacity', baseOpacity).property('_baseOpacity', baseOpacity)
      .attr('marker-end','url(#rgj-arrow)')
      .style('cursor','pointer')
      .on('click', function(){ _rgjShowEdgeInfo(e, data.edges); });
    path.append('title').text(RG_LABEL[e.source]+' → '+RG_LABEL[e.target]+': '+fmtN(e.n)+' transições observadas');
  });

  var nodeSel = svg.selectAll('circle.rgj-node').data(data.nodes).enter().append('circle')
    .attr('class','rgj-node')
    .attr('cx', function(n){return nodeById[n.id].x;})
    .attr('cy', function(n){return nodeById[n.id].y;})
    .attr('r', function(n){return rNode(n.n);})
    .attr('fill', function(n){return RG_COLOR[n.id];})
    .attr('stroke','#050C16').attr('stroke-width',2)
    .style('cursor','grab')
    .on('click', function(ev, n){
      _rgjShowNodeInfo(n, data.nodes);
      _pbNodeClicked('rgjourney', n.id);
    })
    .on('mouseover', function(ev, n){
      svg.selectAll('circle.rgj-node').attr('opacity', function(m){ return (m.id===n.id) ? 1 : 0.25; });
      svg.selectAll('path.rgj-edge').each(function(){
        var el = d3.select(this);
        var conectada = el.attr('data-source')===n.id || el.attr('data-target')===n.id;
        el.attr('stroke-opacity', conectada ? Math.max(el.property('_baseOpacity'), 0.85) : 0.06);
      });
      svg.selectAll('text.rgj-label').attr('opacity', function(m){ return (m.id===n.id) ? 1 : 0.35; });
    })
    .on('mouseout', function(){
      svg.selectAll('circle.rgj-node').attr('opacity', 1);
      svg.selectAll('path.rgj-edge').each(function(){
        var el = d3.select(this);
        el.attr('stroke-opacity', el.property('_baseOpacity'));
      });
      svg.selectAll('text.rgj-label').attr('opacity', 1);
    });
  nodeSel.append('title').text(function(n){return RG_LABEL[n.id]+': '+fmtN(n.n)+' sessões observadas';});

  var labelSel = svg.selectAll('text.rgj-label').data(data.nodes).enter().append('text')
    .attr('class','rgj-label')
    .attr('x', function(n){return nodeById[n.id].x;})
    .attr('y', function(n){return nodeById[n.id].y - rNode(n.n) - 8;})
    .attr('text-anchor','middle').attr('font-size',12).attr('font-weight',700)
    .attr('fill','#D0E8FF').text(function(n){return RG_LABEL[n.id];});

  // Nós têm posição fixa (layout circular), sem simulação de força — mas
  // continuavam travados (sem d3.drag) diferente do Dígrafo principal.
  // Arrastar move só o nó solto + reposiciona label e arestas conectadas,
  // mesmo padrão do fix de drag do Dígrafo (sem reaquecer/mexer no resto).
  nodeSel.call(d3.drag()
    .on('start', function(){ d3.select(this).style('cursor','grabbing'); })
    .on('drag', function(ev, n){
      var p = nodeById[n.id];
      p.x = ev.x; p.y = ev.y;
      d3.select(this).attr('cx', p.x).attr('cy', p.y);
      labelSel.filter(function(m){return m.id===n.id;})
        .attr('x', p.x).attr('y', p.y - rNode(n.n) - 8);
      svg.selectAll('path.rgj-edge').each(function(){
        var el = d3.select(this);
        var src = el.attr('data-source'), tgt = el.attr('data-target');
        if(src===n.id || tgt===n.id){
          el.attr('d', _rgjEdgeD(nodeById[src], nodeById[tgt]));
        }
      });
    })
    .on('end', function(){ d3.select(this).style('cursor','grab'); }));

  // Painel lateral: legenda + ranking + nota metodológica
  var side = '<div class="rgj-card"><div class="ins-title" style="margin-bottom:8px">Nó selecionado</div><div id="rgj-node-info"><div class="pb-hint">Clique em um nó para ver detalhes.</div></div></div>';
  side += '<div class="rgj-card"><div class="ins-title" style="margin-bottom:8px">Aresta selecionada</div><div id="rgj-edge-info"><div class="pb-hint">Clique em uma aresta para ver detalhes.</div></div></div>';
  side += '<div class="rgj-card"><div class="ins-title" style="margin-bottom:8px">&#128257; Categorias (RG)</div>';
  RG_ORDER.forEach(function(rg){
    side += '<div class="rgj-legend-item"><span class="rgj-legend-dot" style="background:'+RG_COLOR[rg]+'"></span>'+RG_LABEL[rg]+'</div>';
  });
  side += '</div>';

  side += '<div class="rgj-card"><div class="ins-title" style="margin-bottom:8px">Ranking por volume'+(S.personaFilter!=='all'?' · '+S.personaFilter:'')+'</div>';
  data.nodes.slice().sort(function(a,b){return b.n-a.n;}).forEach(function(n){
    var pct = Math.round(100*n.n/maxN);
    side += '<div class="rgj-rank-row"><span class="rgj-rank-label">'+RG_LABEL[n.id]+'</span>'+
      '<div class="rgj-rank-bar-wrap"><div class="rgj-rank-bar-fill" style="width:'+pct+'%;background:'+RG_COLOR[n.id]+'"></div></div>'+
      '<span style="min-width:44px;text-align:right;color:#D0E8FF">'+fmtN(n.n)+'</span></div>';
  });
  side += '<div class="rgj-note">Equivalente ao SVA Ranking do JourneyGraph ISP — como a taxonomia de SVA da banda larga fixa não se aplica ao domínio móvel, RG (categoria de serviço do CDR) faz esse papel aqui. Setas = transição real entre categorias na sequência de cada assinante (não permanência na mesma categoria). Nesta amostra sintética a atribuição de RG é ~uniforme por linha, então os volumes/transições ficam parecidos entre categorias — reflexo do gerador, não um padrão de uso real.</div>';
  side += '</div>';

  document.getElementById('rgj-side').innerHTML = side;

  var edgesByPair = {};
  data.edges.forEach(function(e){ edgesByPair[e.source+'|'+e.target]=e; edgesByPair[e.target+'|'+e.source]=e; });
  var totalPorNo = {};
  data.edges.forEach(function(e){ totalPorNo[e.source]=(totalPorNo[e.source]||0)+e.n; totalPorNo[e.target]=(totalPorNo[e.target]||0)+e.n; });
  S._pbCtx = S._pbCtx || {};
  S._pbCtx.rgjourney = {
    edgesByPair: edgesByPair,
    totalSaida: totalPorNo,
    totalSubscribers: d3.sum(data.nodes, function(n){ return n.n; }),
    nodeLabel: function(id){ return RG_LABEL[id] || id; }
  };
  _pbRender('rgjourney');
  _renderSigmaChartRG('sigma-chart-rgj', data.edges);
}

function _rgjShowNodeInfo(n, allNodes){
  var el = document.getElementById('rgj-node-info');
  if(!el) return;
  var totalOutros = d3.sum(allNodes, function(m){ return m.n; }) - n.n;
  var pct = totalOutros>0 ? (100*n.n/totalOutros) : 0;
  el.innerHTML = '<div class="pb-step"><b>'+RG_LABEL[n.id]+'</b></div>'+
    '<div class="pb-step">'+fmtN(n.n)+' sessões observadas</div>'+
    '<div class="pb-step">'+pct.toFixed(1)+'% sobre a soma de todos os demais nós</div>';
}
function _rgjShowEdgeInfo(e, allEdges){
  var el = document.getElementById('rgj-edge-info');
  if(!el) return;
  var totalDoNo = d3.sum(allEdges.filter(function(x){return x.source===e.source;}), function(x){ return x.n; }) || 1;
  var pct = 100*e.n/totalDoNo;
  el.innerHTML = '<div class="pb-step"><b>'+RG_LABEL[e.source]+' &#8594; '+RG_LABEL[e.target]+'</b></div>'+
    '<div class="pb-step">'+fmtN(e.n)+' transições observadas</div>'+
    '<div class="pb-step">'+pct.toFixed(1)+'% entre todas as transições a partir de '+RG_LABEL[e.source]+'</div>';
}

/* Sigma topológico para Jornada RG — não há série diária real para este
   grafo (categorias de serviço, não rede física), então a variação
   dia-a-dia é sintética (jitter determinístico, seed por par de nós),
   deixado explícito na legenda do gráfico. */
function _mulberry32(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ seed>>>15, 1 | seed);
    t = (t + Math.imul(t ^ t>>>7, 61 | t)) ^ t;
    return ((t ^ t>>>14) >>> 0) / 4294967296;
  };
}
function _strSeed(s){ var h=0; for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } return h; }
function _renderSigmaChartRG(elId, edges){
  var el = document.getElementById(elId);
  if(!el || !RAW.personas_daily) return;
  var dias = RAW.personas_daily.dias;
  var values = dias.map(function(_,d){
    var degW = {};
    edges.forEach(function(e){
      var rnd = _mulberry32(_strSeed('rgjsigma|'+e.source+'|'+e.target) + d);
      var wk = 1 + 0.12*Math.sin(2*Math.PI*d/7);
      var v = e.n * wk * (1 + (rnd()-0.5)*0.18);
      degW[e.source] = (degW[e.source]||0) + v;
      degW[e.target] = (degW[e.target]||0) + v;
    });
    var sigma = 0;
    edges.forEach(function(e){ var diff=(degW[e.source]||0)-(degW[e.target]||0); sigma += diff*diff; });
    return sigma;
  });
  el.innerHTML = _multiLineChartSvg(dias, {'σ(G)':values}, {'σ(G)':'#5AC8FA'},
    {h:80, padL:34, fmtV: function(v){ return v>=1e6 ? (v/1e6).toFixed(1)+'M' : v>=1e3 ? (v/1e3).toFixed(0)+'k' : v.toFixed(0); }}) +
    '<div style="font-size:9px;color:#3A6080;margin-top:2px;">Variação diária sintética — Jornada RG não tem série diária real na base.</div>';
}

/* ── Rede — topologia sintética Core→PGW/UPF→SGW→Sites, visão de
   Engenharia/Operação (equivalente móvel da hierarquia POP→OLT→PON→CTO
   do NetGraph). RAW.topologia_rede já vem pronto do pipeline
   (construir_topologia_rede, porta de construir_topologia_core do v1)
   — aqui só desenhamos a árvore radial (d3.hierarchy + d3.tree) e
   calculamos blast radius por clique. ─────────────────────────────── */
var REDE_COLOR = { core:'#E87000', pgw:'#5AC8FA', sgw:'#7C3AED', site:'#567898' };

function renderRede(){
  var tr = RAW.topologia_rede;
  var wrap = document.getElementById('rede-content');
  wrap.innerHTML = '<div id="rede-svg-wrap"><svg id="rede-svg" viewBox="0 0 900 900"></svg></div><div class="rede-side" id="rede-side"></div>';

  var sitesPorSgw = {};
  tr.sites.forEach(function(s){ (sitesPorSgw[s.sgw_id] = sitesPorSgw[s.sgw_id]||[]).push(s); });
  var sgwPorPgw = {};
  tr.sgw.forEach(function(s){ (sgwPorPgw[s.pgw_upf_id] = sgwPorPgw[s.pgw_upf_id]||[]).push(s); });

  var root = {
    id: tr.core.id, tipo: 'core', dados: tr.core,
    children: tr.pgw.map(function(p){
      return { id: p.id, tipo: 'pgw', dados: p,
        children: (sgwPorPgw[p.id]||[]).map(function(s){
          return { id: s.id, tipo: 'sgw', dados: s,
            children: (sitesPorSgw[s.id]||[]).map(function(site){
              return { id: site.id, tipo: 'site', dados: site, children: [] };
            }) };
        }) };
    }),
  };

  var svg = d3.select('#rede-svg');
  var g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.3,4]).on('zoom', function(ev){ g.attr('transform', ev.transform); }));

  var W=900, H=900, R=420;
  var h = d3.hierarchy(root);
  d3.tree().size([2*Math.PI, R])(h);
  h.each(function(d){
    var a = d.x - Math.PI/2;
    d._x = W/2 + d.y*Math.cos(a);
    d._y = H/2 + d.y*Math.sin(a);
  });

  var maxUsu = d3.max(h.descendants(), function(d){return d.data.dados.n_usuarios_est||0;}) || 1;
  var rScale = d3.scaleSqrt().domain([0,maxUsu]).range([3,26]);

  g.selectAll('path.rede-link').data(h.links()).enter().append('path')
    .attr('fill','none').attr('stroke','#1A3050')
    .attr('stroke-width', function(d){ return d.target.data.tipo==='site' ? 0.6 : 1.5; })
    .attr('d', function(d){ return 'M'+d.source._x+','+d.source._y+' L'+d.target._x+','+d.target._y; });

  function _redeAlerta(d){
    var grupo = RAW.alertas_rede[d.data.tipo];
    return grupo ? grupo[d.data.id] : null;
  }

  var node = g.selectAll('circle.rede-node').data(h.descendants()).enter().append('circle')
    .attr('class','rede-node')
    .attr('cx', function(d){return d._x;}).attr('cy', function(d){return d._y;})
    .attr('r', function(d){ return d.data.tipo==='site' ? Math.max(2, rScale(d.data.dados.n_usuarios_est||0)*0.5) : rScale(d.data.dados.n_usuarios_est||0)+4; })
    .attr('fill', function(d){ return REDE_COLOR[d.data.tipo]; })
    .attr('stroke', function(d){ var al = _redeAlerta(d); return al ? REDE_ESTADO_COLOR[al.estado_atual] : '#050C16'; })
    .attr('stroke-width', function(d){ var al = _redeAlerta(d); return al ? (d.data.tipo==='site'?1.2:2.5) : (d.data.tipo==='site'?0.5:1.5); })
    .style('cursor','pointer')
    .on('click', function(ev,d){ _redeSelectNode(d); });
  node.append('title').text(function(d){
    var dd = d.data.dados;
    var al = _redeAlerta(d);
    return d.data.id+' ('+d.data.tipo.toUpperCase()+')\n'+fmtN(Math.round(dd.n_usuarios_est||0))+' assinantes (blast radius)'+
      (dd.drop_medio!=null ? '\nDrop: '+fmtPct(dd.drop_medio) : '')+
      (al ? '\nEstado: '+al.estado_atual+' (P piora='+fmtPct(al.p_piora)+')' : '');
  });

  g.selectAll('text.rede-label').data(h.descendants().filter(function(d){return d.data.tipo!=='site';}))
    .enter().append('text')
    .attr('x', function(d){return d._x;})
    .attr('y', function(d){return d._y - rScale(d.data.dados.n_usuarios_est||0) - 6;})
    .attr('text-anchor','middle').attr('font-size', function(d){return d.data.tipo==='core'?12:10;})
    .attr('font-weight',700).attr('fill','#D0E8FF').style('pointer-events','none')
    .text(function(d){return d.data.id;});

  var side = '<div class="rgj-card"><div class="ins-title" style="margin-bottom:8px">Legenda</div>';
  [['core','Core (1)'],['pgw','PGW/UPF (3)'],['sgw','SGW (6)'],['site','Site físico (213)']].forEach(function(t){
    side += '<div class="rede-legend-item"><span class="rede-legend-dot" style="background:'+REDE_COLOR[t[0]]+'"></span>'+t[1]+'</div>';
  });
  side += '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #16283F;font-size:10px;color:#567898">Borda = estado do alerta (Markov)</div>';
  ['Saudavel','Degradado','Critico','Falha'].forEach(function(e){
    side += '<div class="rede-legend-item"><span class="rede-legend-dot" style="background:'+REDE_ESTADO_COLOR[e]+'"></span>'+e+'</div>';
  });
  side += '</div>';
  side += '<div class="rgj-card" id="rede-detail"></div>';
  side += '<div class="rgj-card"><div class="ins-title" style="margin-bottom:6px">MME/AMF (controle, pool paralelo)</div>'+
    '<table class="rede-mme-table"><thead><tr><th>MME</th><th>Sites</th><th>Assinantes</th><th>Estado</th></tr></thead><tbody>';
  tr.mme.forEach(function(m){
    var al = RAW.alertas_rede.mme[m.id];
    var color = al ? REDE_ESTADO_COLOR[al.estado_atual] : '#567898';
    side += '<tr style="cursor:pointer" onclick="_redeSelectMME(\''+m.id+'\')"><td>'+m.id+'</td><td>'+fmtN(m.n_sites)+'</td><td>'+fmtN(Math.round(m.n_usuarios_est))+'</td>'+
      '<td>'+(al ? '<span class="alert-state" style="background:'+color+'22;color:'+color+';border:1px solid '+color+'">'+al.estado_atual+'</span>' : '—')+'</td></tr>';
  });
  side += '</tbody></table>'+
    '<div class="rgj-note">'+tr.metodologia+' '+RAW.alertas_rede.metodologia+'</div></div>';
  document.getElementById('rede-side').innerHTML = side;
  window._redeMmeData = {};
  tr.mme.forEach(function(m){ window._redeMmeData[m.id] = m; });

  _redeSelectNode(h);
}

function _redeSelectNode(d){
  var dd = d.data.dados;
  var html = '<div class="ins-title" style="margin-bottom:6px">'+d.data.id+' <span style="font-size:10px;color:#8ABEDF">('+d.data.tipo.toUpperCase()+')</span></div>';
  html += '<div class="rede-node-detail">';
  html += '<b>Blast radius:</b> '+fmtN(Math.round(dd.n_usuarios_est||0))+' assinantes<br>';
  if(dd.n_sites!=null) html += '<b>Sites downstream:</b> '+fmtN(dd.n_sites)+'<br>';
  if(dd.n_setores!=null) html += '<b>Setores:</b> '+fmtN(dd.n_setores)+'<br>';
  if(dd.drop_medio!=null) html += '<b>Drop médio:</b> '+fmtPct(dd.drop_medio)+'<br>';
  if(dd.cong_medio!=null) html += '<b>Congestionamento:</b> '+fmtPct(dd.cong_medio)+'<br>';
  if(dd.vamping_score!=null) html += '<b>Vamping:</b> '+dd.vamping_score.toFixed(1)+'/100<br>';
  if(dd.area_nome) html += '<b>Região:</b> '+dd.area_nome+'<br>';
  if(d.data.tipo==='pgw' || d.data.tipo==='sgw'){
    html += '<div style="margin-top:6px;font-size:10px;color:#64748B">Ponto único de falha (SPOF): se este nó falhar, os '+fmtN(dd.n_sites)+' sites downstream ficam sem serviço (~'+fmtN(Math.round(dd.n_usuarios_est))+' assinantes afetados).</div>';
  }
  html += '</div>';

  var grupo = RAW.alertas_rede[d.data.tipo];
  var al = grupo ? grupo[d.data.id] : null;
  if(al){
    var color = REDE_ESTADO_COLOR[al.estado_atual];
    html += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #16283F">';
    html += '<div class="ins-title" style="margin-bottom:4px">Alerta de rede <span class="alert-state" style="background:'+color+'22;color:'+color+';border:1px solid '+color+'">'+al.estado_atual+'</span></div>';
    html += '<div style="font-size:11px;color:#8ABEDF;margin-bottom:6px">P(piora) = <b style="color:#E87000">'+fmtPct(al.p_piora)+'</b> · '+fmtN(al.n_transicoes_observadas)+' transições diárias observadas.</div>';
    html += '<div style="font-size:10px;color:#567898;margin-bottom:4px">Matriz de transição (Markov)</div>';
    html += _markovTable(al);
    html += '<div style="font-size:10px;color:#567898;margin:8px 0 4px">Causa provável (Bayes, evidência = correlação real)</div>';
    al.causas.forEach(function(c){
      html += '<div class="bayes-row"><span class="bayes-lbl">'+c.nome+'</span>'+
        '<div class="bayes-bar-wrap"><div class="bayes-bar-fill" style="width:'+(c.posterior*100)+'%"></div></div>'+
        '<span class="bayes-val">'+fmtPct(c.posterior)+'</span></div>';
    });
    html += '</div>';
  }

  html += _redeCapacidadeOutliersHtml(d.data.tipo, d.data.id);

  var panel = document.getElementById('rede-detail');
  if(panel) panel.innerHTML = html;
}
function _redeSelectMME(id){
  _redeSelectNode({ data: { id: id, tipo: 'mme', dados: window._redeMmeData[id] || {} } });
}
function _redeCapacidadeOutliersHtml(tipo, id){
  var sr = RAW.series_rede;
  var serie = tipo==='site' ? sr.site[id] : (tipo==='sgw' ? sr.sgw[id] : null);
  if(!serie) return '';

  var html = '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #16283F">';
  html += '<div class="ins-title" style="margin-bottom:6px">Capacidade &amp; Outliers <span style="font-size:9px;color:#3A6080">(15 dias)</span></div>';

  if(S.dia!=='all' && S.dia>=0 && S.dia<serie.dias.length){
    html += '<div style="font-size:11px;color:#E87000;margin-bottom:8px;">Dia selecionado — '+serie.dias[S.dia]+': '+
      serie.trafego_gb[S.dia].toFixed(1)+' GB/dia · drop '+fmtPct(serie.drop_pct[S.dia])+' · congestionamento '+fmtPct(serie.cong[S.dia])+'</div>';
  }

  var cap = capacityProjection(serie.trafego_gb, 90);
  html += '<div style="font-size:10px;color:#567898;margin-bottom:2px">Projeção de capacidade (regressão linear, ref. = pico observado)</div>';
  if(cap.hasProjection){
    html += '<div style="font-size:11px;color:#8ABEDF;margin-bottom:8px">Atinge '+cap.thresholdPct+'% do pico em <b style="color:#E87000">~'+Math.round(cap.daysFromNow)+' dias</b> '+
      '(IC95%: '+Math.round(cap.daysLow)+'–'+Math.round(cap.daysHigh)+' dias) · R²='+cap.reg.r2.toFixed(2)+' · pico='+cap.peak.toFixed(1)+' GB/dia</div>';
  } else {
    html += '<div style="font-size:11px;color:#64748B;margin-bottom:8px">'+cap.reason+' (pico='+cap.peak.toFixed(1)+' GB/dia, R²='+cap.reg.r2.toFixed(2)+')</div>';
  }

  if(serie.drop_pct && serie.cong){
    var outDrop = robustOutliers(serie.drop_pct);
    var outCong = robustOutliers(serie.cong);
    html += '<div style="font-size:10px;color:#567898;margin-bottom:2px">Outlier (MAD, |z|&gt;3.5) — último dia da janela</div>';
    html += '<div style="font-size:11px;color:#8ABEDF">Drop: z='+outDrop.lastZ.toFixed(2)+' '+
      (outDrop.isOutlierNow?'<span class="alert-state" style="background:#FF444422;color:#FF4444;border:1px solid #FF4444">OUTLIER</span>':'<span style="color:#567898">normal</span>')+'</div>';
    html += '<div style="font-size:11px;color:#8ABEDF">Congestionamento: z='+outCong.lastZ.toFixed(2)+' '+
      (outCong.isOutlierNow?'<span class="alert-state" style="background:#FF444422;color:#FF4444;border:1px solid #FF4444">OUTLIER</span>':'<span style="color:#567898">normal</span>')+'</div>';
  }

  html += '</div>';
  return html;
}

/* ── Outliers — séries temporais + duas técnicas de detecção lado a
   lado: MAD (já usada na Rede/Etapa 3) e um filtro Bayesiano recursivo
   (modelo local-level / filtro de Kalman) descrito no material de
   apoio da apresentação: θk = argmax p(θ|y1..yk) resolvido de forma
   recursiva a cada novo dado, com um único parâmetro de sensibilidade
   e classificação do erro de predição em anomalia fraca/forte via
   z-score — para um modelo linear-gaussiano local-level, esse MAP
   recursivo é exatamente a média a posteriori do filtro de Kalman, daí
   a implementação abaixo. Quando um outlier é detectado, tenta atribuir
   a causa comparando com o outlier (ou não) do tráfego no mesmo dia:
   pico de tráfego junto = variação de demanda; sem pico de tráfego =
   possível variação de capacidade (falha); qualidade melhor com
   tráfego maior = possível expansão (heurística, não evento real). ── */
function _variance(arr){
  var m = arr.reduce(function(a,b){return a+b;},0)/arr.length;
  return arr.reduce(function(s,v){return s+(v-m)*(v-m);},0)/arr.length;
}
/* Estimador de ruído por diferenças sucessivas (von Neumann): a variância
   bruta da série fica contaminada pela própria tendência/sazonalidade que
   se quer detectar como anomalia (uma série com deriva tem variância alta
   mesmo sem nenhum ponto "estranho"). Diferenças dia-a-dia cancelam a
   tendência lenta e sobra majoritariamente o ruído real — estimador padrão
   para ruído de observação num modelo local-level. */
function _successiveDiffVariance(arr){
  if(arr.length<2) return _variance(arr) || 1e-6;
  var s=0;
  for(var i=1;i<arr.length;i++){ s += (arr[i]-arr[i-1])*(arr[i]-arr[i-1]); }
  return s/(arr.length-1)/2;
}
function bayesianRecursiveOutliers(series, sensibilidade){
  sensibilidade = sensibilidade || 0.05;
  var R = _successiveDiffVariance(series) || 1e-6;  // ruído de observação
  var Q = R * sensibilidade;           // ruído de processo — único parâmetro ajustável
  var mu = series[0], P = R;
  var out = [];
  for(var k=0;k<series.length;k++){
    var muPred = mu, pPred = P + Q;
    var e = series[k] - muPred;
    var S = pPred + R;
    var z = S>0 ? e/Math.sqrt(S) : 0;
    var K = S>0 ? pPred/S : 0;
    mu = muPred + K*e;
    P = (1-K)*pPred;
    var classe = Math.abs(z)>3 ? 'forte' : (Math.abs(z)>2 ? 'fraca' : 'normal');
    out.push({ dia:k, valor:series[k], nivelPrevisto:muPred, banda: Math.sqrt(S), z:z, classe:classe });
  }
  return out;
}
var OUT_SENSIBILIDADE_DEFAULT = 0.05;
var _outSelected = { tipo:'sgw', id:'SGW-01' };
var _outSensibilidade = OUT_SENSIBILIDADE_DEFAULT;

function _outAtribuirCausa(zQualidade, zTrafego){
  if(Math.abs(zQualidade) <= 2) return null;
  var piorou = zQualidade > 0;
  var trafegoAlto = zTrafego > 1.5;
  if(piorou && trafegoAlto){
    return {tipo:'trafego', label:'Tráfego ↑', cor:'#1E90FF',
      texto:'Coincide com pico de tráfego no mesmo dia (z='+zTrafego.toFixed(1)+') — provável variação de demanda (mais uso/fontes), não falha de equipamento.'};
  }
  if(piorou && !trafegoAlto){
    return {tipo:'capacidade_falha', label:'Capacidade ↓', cor:'#FF4444',
      texto:'Sem pico de tráfego correspondente (z='+zTrafego.toFixed(1)+') — degradação não explicada por demanda; possível redução de capacidade (falha/degradação).'};
  }
  if(!piorou && trafegoAlto){
    return {tipo:'capacidade_exp', label:'Capacidade ↑ (heurística)', cor:'#2ECC71',
      texto:'Qualidade melhorou apesar do tráfego em alta (z='+zTrafego.toFixed(1)+') — heurística de possível expansão de capacidade; não há evento real de expansão no dataset, tratar como hipótese.'};
  }
  return {tipo:'indeterminado', label:'Indeterminado', cor:'#567898',
    texto:'Melhora sem correspondência clara de tráfego nesta amostra — padrão não conclusivo.'};
}

function _outListaNos(){
  var tr = RAW.topologia_rede;
  var lista = { sgw: tr.sgw.map(function(s){return s.id;}).sort(),
                pgw: tr.pgw.map(function(p){return p.id;}).sort(),
                site: [] };
  var sites = RAW.series_rede.site;
  Object.keys(sites).sort().forEach(function(id){
    var s = sites[id];
    var od = robustOutliers(s.drop_pct), oc = robustOutliers(s.cong);
    if(od.isOutlierNow || oc.isOutlierNow) lista.site.push(id);
  });
  return lista;
}

function renderOutliers(){
  var wrap = document.getElementById('outliers-content');
  var lista = _outListaNos();
  window._outLista = lista;

  var listHtml = '<div class="out-node-list">';
  listHtml += '<div class="out-node-group-label">SGW (6)</div>';
  lista.sgw.forEach(function(id){ listHtml += _outNodeBtnHtml('sgw', id); });
  listHtml += '<div class="out-node-group-label">PGW/UPF (3)</div>';
  lista.pgw.forEach(function(id){ listHtml += _outNodeBtnHtml('pgw', id); });
  listHtml += '<div class="out-node-group-label">Sites sinalizados ('+lista.site.length+' de '+Object.keys(RAW.series_rede.site).length+', outlier MAD em drop ou congestionamento)</div>';
  if(!lista.site.length) listHtml += '<div style="font-size:11px;color:#3A6080;padding:4px 6px">Nenhum site com outlier MAD detectado nesta execução.</div>';
  lista.site.forEach(function(id){ listHtml += _outNodeBtnHtml('site', id); });
  listHtml += '</div>';

  wrap.innerHTML = listHtml + '<div class="out-main" id="out-main"></div>';
  _outRenderMain();
}
function _outNodeBtnHtml(tipo, id){
  var ativo = (_outSelected.tipo===tipo && _outSelected.id===id);
  return '<button class="out-node-btn'+(ativo?' active':'')+'" onclick="_outSelecionar(\''+tipo+'\',\''+id+'\')">'+
    '<span>'+id+'</span>'+(tipo==='site' ? '<span class="out-flag-dot"></span>' : '')+'</button>';
}
function _outSelecionar(tipo, id){
  _outSelected = {tipo:tipo, id:id};
  document.querySelectorAll('.out-node-btn').forEach(function(b){ b.classList.remove('active'); });
  renderOutliers();
}
function _outSetSensibilidade(v){
  _outSensibilidade = parseFloat(v);
  _outRenderMain();
}

var OUT_INDICADORES = [
  {campo:'trafego_gb', label:'Tráfego (GB/dia)', cor:'#1E90FF'},
  {campo:'drop_pct',   label:'Drop (%)',          cor:'#FF4444', pct:true},
  {campo:'cong',       label:'Congestionamento (%)', cor:'#E87000', pct:true},
];

function _outRenderMain(){
  var main = document.getElementById('out-main');
  if(!main) return;
  var serie = RAW.series_rede[_outSelected.tipo][_outSelected.id];
  if(!serie){ main.innerHTML = '<div style="color:#567898;font-size:12px">Sem série disponível para este nó.</div>'; return; }

  var html = '<div class="out-chart-card">';
  html += '<div class="ins-title" style="margin-bottom:4px">'+_outSelected.id+' <span style="font-size:10px;color:#8ABEDF">('+_outSelected.tipo.toUpperCase()+') · 15 dias</span></div>';
  html += '<div class="out-sens-row">Sensibilidade do filtro Bayesiano (Q/R): <b id="out-sens-val">'+_outSensibilidade.toFixed(3)+'</b>'+
    '<input type="range" min="0.005" max="0.30" step="0.005" value="'+_outSensibilidade+'" '+
    'oninput="document.getElementById(\'out-sens-val\').textContent=parseFloat(this.value).toFixed(3)" '+
    'onchange="_outSetSensibilidade(this.value)">'+
    '<span style="font-size:10px;color:#3A6080">menor = mais sensível (flags mais fáceis) · maior = mais tolerante (absorve variação como normal)</span>';
  html += '</div>';
  html += '</div>';

  var trafegoBayes = bayesianRecursiveOutliers(serie.trafego_gb, _outSensibilidade);
  var atribuicoesTodas = [];

  OUT_INDICADORES.forEach(function(ind){
    if(!serie[ind.campo]) return;
    var vals = serie[ind.campo];
    var mad = robustOutliers(vals);
    var bayes = ind.campo==='trafego_gb' ? trafegoBayes : bayesianRecursiveOutliers(vals, _outSensibilidade);

    html += '<div class="out-chart-card">';
    html += '<div class="out-chart-title">'+ind.label+'</div>';
    html += _outChartSvg(serie.dias, vals, mad, bayes, ind.cor, ind.pct);
    html += '<div class="out-legend">'+
      '<span class="out-legend-item"><span class="out-legend-swatch" style="background:'+ind.cor+'"></span>valor observado</span>'+
      '<span class="out-legend-item"><span class="out-legend-swatch" style="background:#8ABEDF;opacity:.6"></span>nível previsto (Bayesiano)</span>'+
      '<span class="out-legend-item"><span class="out-legend-dot" style="background:#FF4444;border:1px solid #fff"></span>outlier MAD (|z|&gt;3.5)</span>'+
      '<span class="out-legend-item"><span class="out-legend-dot" style="background:none;border:2px solid #F0C000"></span>anomalia fraca (Bayes, |z|&gt;2)</span>'+
      '<span class="out-legend-item"><span class="out-legend-dot" style="background:none;border:2px solid #FF4444"></span>anomalia forte (Bayes, |z|&gt;3)</span>'+
      '</div>';

    if(ind.campo !== 'trafego_gb'){
      bayes.forEach(function(pt, i){
        var causa = _outAtribuirCausa(pt.z, trafegoBayes[i].z);
        if(causa) atribuicoesTodas.push({dia:i, data:serie.dias[i], indicador:ind.label, classe:pt.classe, causa:causa});
      });
    }
    html += '</div>';
  });

  html += '<div class="out-chart-card"><div class="out-chart-title">Atribuição de causa (tráfego × capacidade)</div>';
  if(!atribuicoesTodas.length){
    html += '<div style="font-size:11px;color:#3A6080">Nenhuma anomalia de qualidade (Bayes, |z|&gt;2) neste nó com a sensibilidade atual.</div>';
  } else {
    atribuicoesTodas.sort(function(a,b){return a.dia-b.dia;}).forEach(function(a){
      html += '<div class="out-attr-row"><span class="out-attr-badge" style="background:'+a.causa.cor+'22;color:'+a.causa.cor+';border:1px solid '+a.causa.cor+'">'+a.causa.label+'</span>'+
        '<span class="out-attr-txt"><b style="color:#D0E8FF">'+a.data+' · '+a.indicador+'</b> ('+a.classe+') — '+a.causa.texto+'</span></div>';
    });
  }
  html += '<div class="rgj-note">Heurística de atribuição: compara o z-score do filtro Bayesiano no indicador de qualidade com o z-score do mesmo dia no tráfego do próprio nó — não é uma causa diagnosticada, é uma correspondência estatística entre séries já reais do dataset (sem dado externo de falha/expansão, que não existe nesta base sintética).</div>';
  html += '</div>';

  main.innerHTML = html;
}

function _outChartSvg(dias, vals, mad, bayes, cor, isPct){
  var W=680, H=170, padL=36, padR=8, padT=10, padB=18;
  var n = vals.length;
  var x = function(i){ return padL + (W-padL-padR) * (n<=1?0:i/(n-1)); };
  var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  var bandLo = Math.min.apply(null, bayes.map(function(p){return p.nivelPrevisto-p.banda;}));
  var bandHi = Math.max.apply(null, bayes.map(function(p){return p.nivelPrevisto+p.banda;}));
  lo = Math.min(lo, bandLo); hi = Math.max(hi, bandHi);
  var pad = (hi-lo)*0.1 || 1;
  lo -= pad; hi += pad;
  var y = function(v){ return H-padB - (H-padT-padB) * (hi<=lo?0.5:(v-lo)/(hi-lo)); };
  var fmt = function(v){ return isPct ? (v*100).toFixed(1)+'%' : v.toFixed(1); };

  var bandPath = 'M'+bayes.map(function(p,i){return x(i)+','+y(p.nivelPrevisto+p.banda);}).join(' L')+
    ' L'+bayes.slice().reverse().map(function(p,i){var idx=bayes.length-1-i; return x(idx)+','+y(p.nivelPrevisto-p.banda);}).join(' L')+' Z';
  var linePath = 'M'+vals.map(function(v,i){return x(i)+','+y(v);}).join(' L');
  var predPath = 'M'+bayes.map(function(p,i){return x(i)+','+y(p.nivelPrevisto);}).join(' L');

  var svg = '<svg class="out-chart-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">';
  svg += '<text x="2" y="'+(y(hi)+4)+'" font-size="9" fill="#3A6080">'+fmt(hi)+'</text>';
  svg += '<text x="2" y="'+(y(lo)+4)+'" font-size="9" fill="#3A6080">'+fmt(lo)+'</text>';
  svg += '<path d="'+bandPath+'" fill="#8ABEDF" opacity="0.12" stroke="none"/>';
  svg += '<path d="'+predPath+'" fill="none" stroke="#8ABEDF" stroke-width="1.2" stroke-dasharray="3 2" opacity="0.7"/>';
  svg += '<path d="'+linePath+'" fill="none" stroke="'+cor+'" stroke-width="2"/>';
  if(S.dia!=='all' && S.dia>=0 && S.dia<n){
    svg += '<line x1="'+x(S.dia)+'" y1="'+padT+'" x2="'+x(S.dia)+'" y2="'+(H-padB)+'" stroke="#E87000" stroke-width="1.4" stroke-dasharray="3 2" opacity="0.85"/>';
    svg += '<text x="'+x(S.dia)+'" y="'+(padT+9)+'" font-size="8" fill="#E87000" text-anchor="middle">'+dias[S.dia]+'</text>';
  }
  vals.forEach(function(v,i){
    var madOut = mad.isOutlier[i];
    var bClasse = bayes[i].classe;
    var selecionado = S.dia===i;
    var r = (madOut ? 4.5 : (bClasse!=='normal' ? 4 : 2.5)) + (selecionado ? 2 : 0);
    svg += '<circle cx="'+x(i)+'" cy="'+y(v)+'" r="'+r+'" fill="'+(madOut?'#FF4444':cor)+'" '+
      (selecionado ? 'stroke="#E87000" stroke-width="2.5"' : bClasse==='forte' ? 'stroke="#FF4444" stroke-width="2"' : bClasse==='fraca' ? 'stroke="#F0C000" stroke-width="2"' : 'stroke="#050C16" stroke-width="1"')+'>'+
      '<title>'+dias[i]+': '+fmt(v)+(madOut?' · outlier MAD':'')+(bClasse!=='normal'?' · Bayes '+bClasse+' (z='+bayes[i].z.toFixed(2)+')':'')+'</title></circle>';
  });
  svg += '</svg>';
  return svg;
}

/* ══════════════════════════════════════════════════════════════════════
   Detecção CDR-a-CDR — porta da metodologia real do CDRVIEW: dois
   algoritmos de alarme (eventos sucessivos + limiar estatístico por
   janela) sobre CDR bruto, com distribuição EXATA (binomial/beta), não
   aproximação normal nem estatística robusta não-paramétrica (MAD/Bayes
   recursivo, usados no resto do produto). Todo o cálculo pesado
   (realização Bernoulli, testes exatos por janela) já vem pronto do
   pipeline em RAW.deteccao_cdr — aqui só renderiza. ────────────────── */
var _detSelecionado = null;
function renderDeteccao(){
  var dc = RAW.deteccao_cdr;
  var ids = Object.keys(dc.recursos).sort();
  if(!_detSelecionado) _detSelecionado = dc.incidente && dc.recursos[dc.incidente.site] ? dc.incidente.site : ids[0];

  var listHtml = '<div class="det-node-list">';
  listHtml += '<div class="out-node-group-label">Recursos cadastrados ('+ids.length+')</div>';
  ids.forEach(function(id){
    var r = dc.recursos[id];
    var nAlarmes = r.n_alarmes_100 + r.n_alarmes_400 + r.eventos_sucessivos.length;
    var ativo = id===_detSelecionado;
    listHtml += '<button class="det-node-btn'+(ativo?' active':'')+'" onclick="_detSelecionar(\''+id+'\')">'+
      '<div class="det-node-id">'+id+(r.tem_incidente_conhecido?'<span class="det-incident-dot" title="Incidente conhecido"></span>':'')+'</div>'+
      '<div class="det-node-sub">'+fmtN(r.n_cdrs_total)+' CDR · '+(r.cadastrado?'cadastrado '+r.cadastro_dia:'não cadastrado')+' · '+nAlarmes+' alarme(s)</div>'+
      '</button>';
  });
  listHtml += '</div>';

  document.getElementById('deteccao-content').innerHTML = listHtml + '<div class="det-main" id="det-main"></div>';
  _detRenderMain();
}
function _detSelecionar(id){
  _detSelecionado = id;
  renderDeteccao();
}
function _detRenderMain(){
  var dc = RAW.deteccao_cdr;
  var r = dc.recursos[_detSelecionado];
  var main = document.getElementById('det-main');
  if(!r){ main.innerHTML=''; return; }

  var html = '';
  if(r.tem_incidente_conhecido){
    html += '<div class="det-incident-banner"><b>&#9888; Cenário de incidente conhecido aplicado a este site ('+dc.incidente.dia_inicio+' a '+dc.incidente.dia_fim+')</b><br>'+dc.incidente.descricao+'</div>';
  }

  html += '<div class="det-card"><div class="det-card-title">'+_detSelecionado+'</div>';
  html += '<div class="det-stat-row"><span>CDRs observados</span><b>'+fmtN(r.n_cdrs_total)+'</b></div>';
  html += '<div class="det-stat-row"><span>Cadastro dinâmico</span><b>'+(r.cadastrado?'ativo desde '+r.cadastro_dia+' (após acumular '+fmtN(dc.min_cadastro)+' CDR)':'ainda não atingiu '+fmtN(dc.min_cadastro)+' CDR')+'</b></div>';
  html += '<div class="det-stat-row"><span>Taxa empírica observada (Bernoulli realizado)</span><b>'+fmtPct(r.taxa_empirica)+'</b></div>';
  html += '<div class="det-stat-row"><span>NQA de referência</span><b>'+fmtPct(dc.nqa)+'</b></div>';
  html += '<div class="det-stat-row"><span>K de eventos sucessivos (p̂^K &lt; '+dc.erro_alvo+')</span><b>'+r.k_eventos_sucessivos+'</b></div>';
  html += '</div>';

  ['janelas_100', 'janelas_400'].forEach(function(campo){
    var tam = campo==='janelas_100' ? 100 : 400;
    var janelas = r[campo];
    var alarmes = janelas.filter(function(w){return w.alarme;});
    html += '<div class="det-card"><div class="det-card-title">Limiar estatístico — janela de '+tam+' CDR ('+janelas.length+' janela(s), '+alarmes.length+' alarme(s))</div>';
    html += _detChartSvg(janelas, dc.nqa);
    html += _detChartResumo(janelas);
    if(alarmes.length){
      alarmes.slice(0, 15).forEach(function(w){
        html += '<div class="det-alarm-row"><span class="det-alarm-badge">ALARME</span>'+
          '<span>'+w.dia_inicio+' a '+w.dia_fim+' — k='+w.k+'/'+w.n+' ('+fmtPct(w.p_hat)+'), p='+w.p_valor.toExponential(2)+', IC 99,9999%: ['+fmtPct(w.ic_inf)+'; '+fmtPct(w.ic_sup)+']</span></div>';
      });
      if(alarmes.length>15) html += '<div style="font-size:10px;color:#3A6080;margin-top:4px">+'+(alarmes.length-15)+' alarme(s) adicional(is) não exibido(s).</div>';
    } else {
      html += '<div style="font-size:11px;color:#3A6080">Nenhuma janela cruzou o erro-alvo ('+dc.erro_alvo+') neste recurso.</div>';
    }
    html += '</div>';
  });

  html += '<div class="det-card"><div class="det-card-title">Eventos sucessivos (K='+r.k_eventos_sucessivos+' consecutivos)</div>';
  if(r.eventos_sucessivos.length){
    r.eventos_sucessivos.forEach(function(e){
      html += '<div class="det-alarm-row"><span class="det-alarm-badge">ALARME</span><span>'+e.dia_inicio+' a '+e.dia_fim+' — run de '+e.tamanho_run+' evento(s) consecutivo(s)</span></div>';
    });
  } else {
    html += '<div style="font-size:11px;color:#3A6080">Nenhum run de '+r.k_eventos_sucessivos+' eventos consecutivos observado neste recurso.</div>';
  }
  html += '</div>';

  // ── Fase 2: bloqueio de voz/VoLTE (Bernoulli genuino) + tempo (Gama exato) ──
  html += '<div class="det-card"><div class="det-card-title">Fase 2 — Bloqueio de voz/VoLTE (evento genuíno: chamadas × completamento_voz)</div>';
  html += '<div class="det-stat-row"><span>NQA de voz de referência</span><b>'+fmtPct(dc.nqa_voz)+'</b></div>';
  html += '</div>';

  [['voz_janelas_400', 400], ['voz_janelas_1600', 1600]].forEach(function(par){
    var janelas = r[par[0]];
    var alarmes = janelas.filter(function(w){return w.alarme_bloqueio;});
    html += '<div class="det-card"><div class="det-card-title">Bloqueio de voz — janela de '+fmtN(par[1])+' chamadas ('+janelas.length+' janela(s), '+alarmes.length+' alarme(s))</div>';
    html += _detChartSvg(janelas, dc.nqa_voz, 'p_hat_bloqueio', 'alarme_bloqueio', 'p_valor_bloqueio');
    html += _detChartResumo(janelas, 'p_hat_bloqueio', 'alarme_bloqueio');
    if(alarmes.length){
      alarmes.slice(0, 15).forEach(function(w){
        html += '<div class="det-alarm-row"><span class="det-alarm-badge">ALARME</span>'+
          '<span>'+w.dia_inicio+' a '+w.dia_fim+' — '+fmtN(w.k_bloqueadas)+'/'+fmtN(w.n_chamadas)+' chamadas bloqueadas ('+fmtPct(w.p_hat_bloqueio)+'), p='+w.p_valor_bloqueio.toExponential(2)+'</span></div>';
      });
      if(alarmes.length>15) html += '<div style="font-size:10px;color:#3A6080;margin-top:4px">+'+(alarmes.length-15)+' alarme(s) adicional(is) não exibido(s).</div>';
    } else {
      html += '<div style="font-size:11px;color:#3A6080">Nenhuma janela cruzou o erro-alvo ('+dc.erro_alvo+') neste recurso.</div>';
    }
    html += '</div>';
  });

  html += '<div class="det-card"><div class="det-card-title">Tempo de conversa — teste Gama exato (soma aditiva, sem aproximação normal)</div>';
  var alarmesGama = (r.voz_janelas_400||[]).concat(r.voz_janelas_1600||[]).filter(function(w){return w.alarme_gama;});
  html += _detGamaChartSvg(r.voz_janelas_400);
  if(alarmesGama.length){
    alarmesGama.slice(0,15).forEach(function(w){
      html += '<div class="det-alarm-row"><span class="det-alarm-badge">ALARME</span>'+
        '<span>'+w.dia_inicio+' a '+w.dia_fim+' — média de conversa '+w.media_conversacao_seg+'s, p='+w.p_valor_gama.toExponential(2)+'</span></div>';
    });
    if(alarmesGama.length>15) html += '<div style="font-size:10px;color:#3A6080;margin-top:4px">+'+(alarmesGama.length-15)+' alarme(s) adicional(is) não exibido(s).</div>';
  } else {
    html += '<div style="font-size:11px;color:#3A6080">Nenhuma janela cruzou o erro-alvo ('+dc.erro_alvo+') neste recurso.</div>';
  }
  html += '</div>';

  html += '<div class="det-card"><div class="det-card-title">Engset — cruzamento ilustrativo (não é alarme por janela)</div>';
  html += '<div style="font-size:10.5px;color:#8ABEDF;margin-bottom:6px">Capacidade e fator de hora-pico são PREMISSAS ilustrativas, não dado de engenharia validado. N de fontes é o número real de assinantes distintos observados no CDR deste site.</div>';
  html += '<div class="det-stat-row"><span>Setores neste site</span><b>'+r.engset.n_setores+'</b></div>';
  html += '<div class="det-stat-row"><span>Capacidade assumida (canais de voz)</span><b>'+fmtN(r.engset.capacidade_assumida)+'</b></div>';
  html += '<div class="det-stat-row"><span>N de fontes finitas (assinantes distintos reais)</span><b>'+fmtN(r.engset.n_fontes)+'</b></div>';
  html += '<div class="det-stat-row"><span>Tráfego ofertado (24h média → hora-pico ilustrativa, ×3)</span><b>'+r.engset.trafego_erlangs_24h+' → '+r.engset.trafego_erlangs_hora_pico+' Erlang</b></div>';
  html += '<div class="det-stat-row"><span>Blocking teórico (Engset, dada a capacidade assumida)</span><b>'+fmtPct(r.engset.blocking_engset_teorico)+'</b></div>';
  html += '<div class="det-stat-row"><span>Blocking realizado observado (Binomial genuíno)</span><b style="color:#E87000">'+fmtPct(r.engset.blocking_realizado_observado)+'</b></div>';
  html += '<div class="rgj-note">Gap grande entre teórico e observado é esperado e informativo aqui: a capacidade assumida é generosa o suficiente para tornar o bloqueio por radiofrequência teoricamente desprezível — o "não completamento" realizado observado provavelmente reflete outras causas (falha de sinalização, handover, etc.), não exaustão pura de capacidade sob esta premissa.</div>';
  html += '</div>';

  html += '<div class="rgj-note">'+dc.metodologia+'</div>';

  main.innerHTML = html;
}
function _detChartSvg(janelas, nqa, campoValor, campoAlarme, campoPvalor){
  campoValor = campoValor || 'p_hat'; campoAlarme = campoAlarme || 'alarme'; campoPvalor = campoPvalor || 'p_valor';
  var W=680, H=190, padL=46, padR=10, padT=16, padB=22;
  var n = janelas.length;
  if(!n) return '<div style="font-size:11px;color:#3A6080">Sem janelas suficientes.</div>';
  var vals = janelas.map(function(w){return w[campoValor];});
  var hi = Math.max(nqa*2, Math.max.apply(null, vals) * 1.15);
  var x = function(i){ return padL + (W-padL-padR) * (n<=1?0:i/(n-1)); };
  var y = function(v){ return H-padB - (H-padT-padB) * (v/hi); };

  var svg = '<svg class="det-chart-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">';

  // faixas de referência: acima do NQA (território de alarme) vs abaixo (baseline)
  svg += '<rect x="'+padL+'" y="'+padT+'" width="'+(W-padL-padR)+'" height="'+Math.max(0,(y(nqa)-padT))+'" fill="#FF444412"/>';
  svg += '<rect x="'+padL+'" y="'+y(nqa)+'" width="'+(W-padL-padR)+'" height="'+Math.max(0,(H-padB-y(nqa)))+'" fill="#1E90FF0A"/>';

  // eixo: topo (hi) e base (0%)
  svg += '<line x1="'+padL+'" y1="'+padT+'" x2="'+(W-padR)+'" y2="'+padT+'" stroke="#1A3050" stroke-width="1"/>';
  svg += '<text x="2" y="'+(padT+4)+'" font-size="9" fill="#3A6080">'+fmtPct(hi)+'</text>';
  svg += '<line x1="'+padL+'" y1="'+(H-padB)+'" x2="'+(W-padR)+'" y2="'+(H-padB)+'" stroke="#1A3050" stroke-width="1"/>';
  svg += '<text x="2" y="'+(H-padB+3)+'" font-size="9" fill="#3A6080">0%</text>';

  // faixas de destaque para corridas contíguas de janelas em alarme (evita blob de círculos sobrepostos)
  var runs = [];
  (function(){
    var i=0;
    while(i<n){
      if(janelas[i][campoAlarme]){
        var start=i;
        while(i<n && janelas[i][campoAlarme]) i++;
        runs.push([start, i-1]);
      } else { i++; }
    }
  })();
  runs.forEach(function(run){
    var start=run[0], end=run[1];
    var runVals = janelas.slice(start,end+1).map(function(w){return w[campoValor];});
    var vMin=Math.min.apply(null,runVals), vMax=Math.max.apply(null,runVals);
    var x0 = start===0 ? padL : (x(start-1)+x(start))/2;
    var x1 = end===n-1 ? (W-padR) : (x(end)+x(end+1))/2;
    svg += '<rect x="'+x0.toFixed(1)+'" y="'+padT+'" width="'+Math.max(1,(x1-x0)).toFixed(1)+'" height="'+(H-padT-padB)+'" fill="#FF444426" stroke="#FF444455" stroke-width="0.5">'+
      '<title>'+(end-start+1)+' janela(s) em alarme · p̂ entre '+fmtPct(vMin)+' e '+fmtPct(vMax)+' · '+janelas[start].dia_inicio+' a '+janelas[end].dia_fim+'</title></rect>';
  });

  // série — linha contínua (mostra a forma/tendência mesmo em alta densidade de janelas)
  var pts = janelas.map(function(w,i){ return x(i).toFixed(1)+','+y(w[campoValor]).toFixed(1); }).join(' ');
  svg += '<polyline points="'+pts+'" fill="none" stroke="#1E90FF" stroke-width="1.6" opacity="0.9"/>';

  // linha de referência do NQA — desenhada por cima da série para nunca ficar coberta
  svg += '<line x1="'+padL+'" y1="'+y(nqa)+'" x2="'+(W-padR)+'" y2="'+y(nqa)+'" stroke="#E8B000" stroke-width="1.3" stroke-dasharray="4 3"/>';
  var nqaLabel = 'NQA '+fmtPct(nqa);
  var nqaLabelW = nqaLabel.length*5.3+6;
  svg += '<rect x="'+(W-padR-nqaLabelW).toFixed(1)+'" y="'+(y(nqa)-13).toFixed(1)+'" width="'+nqaLabelW.toFixed(1)+'" height="13" fill="#0C1829" opacity="0.92" rx="2"/>';
  svg += '<text x="'+(W-padR-3)+'" y="'+(y(nqa)-4)+'" font-size="9" fill="#E8B000" text-anchor="end">'+nqaLabel+'</text>';

  // marcadores — corridas curtas mostram cada janela; corridas densas mostram só o pico (rotulado)
  runs.forEach(function(run){
    var start=run[0], end=run[1];
    if(end-start+1 <= 3){
      for(var k=start;k<=end;k++){
        var w=janelas[k];
        svg += '<circle cx="'+x(k).toFixed(1)+'" cy="'+y(w[campoValor]).toFixed(1)+'" r="4" fill="#FF4444" stroke="#0C1829" stroke-width="1.5">'+
          '<title>'+w.dia_inicio+' a '+w.dia_fim+': p̂='+fmtPct(w[campoValor])+' · ALARME (p='+w[campoPvalor].toExponential(2)+')</title></circle>';
      }
    } else {
      var peakIdx=start, peakVal=janelas[start][campoValor];
      for(var k=start;k<=end;k++){ if(janelas[k][campoValor]>peakVal){ peakVal=janelas[k][campoValor]; peakIdx=k; } }
      svg += '<circle cx="'+x(peakIdx).toFixed(1)+'" cy="'+y(peakVal).toFixed(1)+'" r="4.5" fill="#FF4444" stroke="#0C1829" stroke-width="1.5">'+
        '<title>'+(end-start+1)+' janelas em alarme nesta faixa · pico p̂='+fmtPct(peakVal)+' em '+janelas[peakIdx].dia_inicio+'</title></circle>';
    }
  });

  svg += '</svg>';
  return svg;
}
function _detChartResumo(janelas, campoValor, campoAlarme){
  campoValor = campoValor || 'p_hat'; campoAlarme = campoAlarme || 'alarme';
  var alarmes = janelas.filter(function(w){return w[campoAlarme];});
  if(!alarmes.length) return '';
  var vals = alarmes.map(function(w){return w[campoValor];});
  var vMin=Math.min.apply(null,vals), vMax=Math.max.apply(null,vals);
  return '<div class="det-chart-summary">'+alarmes.length+' janela(s) em alarme nesta série · p̂ entre <b>'+fmtPct(vMin)+'</b> e <b>'+fmtPct(vMax)+'</b></div>';
}
function _detGamaChartSvg(janelas){
  var W=680, H=140, padL=40, padR=8, padT=10, padB=18;
  var n = janelas.length;
  if(!n) return '<div style="font-size:11px;color:#3A6080">Sem janelas suficientes.</div>';
  var x = function(i){ return padL + (W-padL-padR) * (n<=1?0:i/(n-1)); };
  var vals = janelas.map(function(w){return w.media_conversacao_seg;});
  var lo = Math.min.apply(null, vals) * 0.9, hi = Math.max.apply(null, vals) * 1.1;
  var y = function(v){ return H-padB - (H-padT-padB) * (hi<=lo?0.5:(v-lo)/(hi-lo)); };
  var svg = '<svg class="det-chart-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">';
  svg += '<text x="2" y="'+(y(hi)+4)+'" font-size="9" fill="#3A6080">'+hi.toFixed(0)+'s</text>';
  svg += '<text x="2" y="'+(y(lo)+4)+'" font-size="9" fill="#3A6080">'+lo.toFixed(0)+'s</text>';
  janelas.forEach(function(w,i){
    var r = w.alarme_gama ? 4 : 2;
    svg += '<circle cx="'+x(i)+'" cy="'+y(w.media_conversacao_seg)+'" r="'+r+'" fill="'+(w.alarme_gama?'#FF4444':'#2ECC71')+'" opacity="'+(w.alarme_gama?1:0.55)+'">'+
      '<title>'+w.dia_inicio+' a '+w.dia_fim+': média='+w.media_conversacao_seg+'s'+(w.alarme_gama?' · ALARME (p='+w.p_valor_gama.toExponential(2)+')':'')+'</title></circle>';
  });
  svg += '</svg>';
  return svg;
}

/* ── Personas ─────────────────────────────────────────────────────── */
var PERSONA_ICON = {
  P1: '&#128188;', // Executivo Mobile
  P2: '&#127909;', // Streamer
  P3: '&#128645;', // Comutador Urbano Diário
  P4: '&#128201;', // Churn Silencioso
  P5: '&#128225;', // Big Data User
  P6: '&#128222;', // Usuário de Voz Premium
  P7: '&#129395;', // Multi-SIM / Itinerante (mala de viagem)
  P8: '&#128172;', // Social/Comunicação Intenso
  P9: '&#127918;'  // Gamer
};
function _personasPieSvg(){
  var W=200, H=200, r=92;
  var pie = d3.pie().value(function(p){return p.pct;}).sort(null);
  var arc = d3.arc().innerRadius(46).outerRadius(r);
  var arcs = pie(RAW.personas);
  var svg = '<svg viewBox="0 0 '+W+' '+H+'" style="width:200px;height:200px;flex-shrink:0;"><g transform="translate('+(W/2)+','+(H/2)+')">';
  arcs.forEach(function(a){
    var p = a.data;
    svg += '<path d="'+arc(a)+'" fill="#'+p.cor_hex+'" stroke="#050C16" stroke-width="1.5">'+
      '<title>'+p.id+' '+p.nome+': '+p.pct+'%</title></path>';
  });
  svg += '</g></svg>';
  return svg;
}
function renderPersonas(){
  var html = '<div class="pc" style="grid-column:1/-1;display:flex;align-items:center;gap:20px;flex-wrap:wrap;">'+
    _personasPieSvg()+
    '<div style="display:flex;flex-wrap:wrap;gap:10px;flex:1;min-width:220px;">'+
    RAW.personas.map(function(p){
      return '<span style="font-size:11.5px;color:#D0E8FF;display:inline-flex;align-items:center;gap:5px;background:#0A1422;border:1px solid #1A3050;border-radius:14px;padding:4px 10px;">'+
        '<span style="font-size:14px;">'+PERSONA_ICON[p.id]+'</span>'+
        '<span style="width:8px;height:8px;border-radius:50%;background:#'+p.cor_hex+';display:inline-block;"></span>'+
        p.id+' '+p.nome+' — <b>'+p.pct+'%</b></span>';
    }).join('')+
    '</div></div>';
  RAW.personas.forEach(function(p){
    var q = RAW.quality_by_persona.filter(function(x){return x.persona_id===p.id;})[0] || {};
    var vamp = RAW.vamping.by_persona.filter(function(x){return x.persona_id===p.id;})[0];
    html += '<div class="pc" style="border-left-color:#'+p.cor_hex+'">'+
      '<div class="pc-head"><div class="pc-avatar" style="background:#'+p.cor_hex+'22;border:1px solid #'+p.cor_hex+'">'+(PERSONA_ICON[p.id]||'&#128100;')+'</div>'+
      '<div><div class="pc-name">'+p.id+' · '+p.nome+'</div><div class="pc-n">'+fmtN(p.n)+' assinantes ('+p.pct+'%) · confiança média '+fmtPct(p.confianca_media)+'</div></div></div>'+
      '<div class="pc-desc">'+p.descricao+'</div>'+
      '<div class="pc-criteria"><b>Inclusão:</b> '+p.criterio_inclusao+'<br><b>Exclusão:</b> '+p.criterio_exclusao+'</div>'+
      '<div class="pc-bar-row"><span class="pc-bar-lbl">Drop médio</span><div class="pc-bar-wrap"><div class="pc-bar-fill" style="width:'+Math.min(100,q.drop_medio*100*6)+'%;background:#FF4444"></div></div><span style="font-size:11px;color:#8ABEDF">'+fmtPct(q.drop_medio||0)+'</span></div>'+
      '<div class="pc-bar-row"><span class="pc-bar-lbl">Download total</span><div class="pc-bar-wrap"><div class="pc-bar-fill" style="width:'+Math.min(100, (q.download_gb_total||0)/100)+'%;background:#1E90FF"></div></div><span style="font-size:11px;color:#8ABEDF">'+fmtN(Math.round(q.download_gb_total||0))+' GB</span></div>'+
      (vamp ? '<div class="pc-bar-row"><span class="pc-bar-lbl">&#127772; Vamping</span><div class="pc-bar-wrap"><div class="pc-bar-fill" style="width:'+vamp.score_medio+'%;background:#9333EA"></div></div><span style="font-size:11px;color:#8ABEDF">'+vamp.score_medio+'/100 · '+vamp.pct_flag+'% flag</span></div>' : '')+
      '<div style="margin-top:8px;font-size:11px;color:#567898">Qualidade esperada: '+p.qualidade_rede_esperada+'</div>'+
      '</div>';
  });
  document.getElementById('personas-grid').innerHTML = html;
}

/* ── Qualidade ────────────────────────────────────────────────────── */
var SEGMENTO_QUALITY_ADJUST = {
  all: {drop:1, cong:1},
  pos_pago: {drop:0.85, cong:0.85},   // aparelhos/planos premium — ilustrativo
  controle: {drop:1.0, cong:1.0},
  pre_pago: {drop:1.15, cong:1.15}    // ilustrativo
};
function _qualityAdjustedByPersona(){
  var segAdj = SEGMENTO_QUALITY_ADJUST[S.segmento] || SEGMENTO_QUALITY_ADJUST.all;
  var useClusterDia = (S.clusters!=null) || (S.dia!=='all');
  var nodesF = useClusterDia ? _filteredNodesForDisplay() : null;
  return RAW.quality_by_persona.map(function(q){
    var out = Object.assign({}, q);
    if(nodesF){
      var sw=0, sDrop=0, sCong=0;
      nodesF.forEach(function(n){
        var w = (n.mix && n.mix[q.persona_id]) || 0;
        if(w<=0) return;
        sw += w; sDrop += w*n.drop_medio; sCong += w*n.cong_medio;
      });
      if(sw>0){ out.drop_medio = sDrop/sw; out.cong_medio = sCong/sw; }
    }
    out.drop_medio = out.drop_medio * segAdj.drop;
    out.cong_medio = Math.min(1, out.cong_medio * segAdj.cong);
    return out;
  });
}
function renderQuality(){
  var html = '<div class="qual-grid">';
  var qAdj = _qualityAdjustedByPersona();
  var filtroAtivo = S.segmento!=='all' || S.clusters!=null || S.dia!=='all';
  if(filtroAtivo){
    html += '<div class="qual-sub" style="grid-column:1/-1;color:#E87000;">Drop/Congestionamento recalculados para o filtro atual (Segmento/Cluster/Dia). Completamento de voz/SMS não têm granularidade por cluster/dia na base — seguem o agregado da janela toda.</div>';
  }

  html += '<div class="qual-card"><div class="qual-title">&#9670; Taxa de Drop por Persona</div><div class="qual-sub">Threshold de alerta de referência: 8%</div>';
  qAdj.forEach(function(q){
    var p = PERSONA_MAP[q.persona_id];
    var color = q.drop_medio>0.08 ? '#FF4444' : (q.drop_medio>0.06?'#E87000':'#2ECC71');
    html += '<div class="iqre-bar-row"><span class="iqre-seg-lbl">'+q.persona_id+' '+p.nome+'</span>'+
      '<div class="iqre-bar-wrap"><div class="iqre-bar-fill" style="width:'+Math.min(100,q.drop_medio*100*8)+'%;background:'+color+'"></div></div>'+
      '<span class="iqre-val" style="color:'+color+'">'+fmtPct(q.drop_medio)+'</span></div>';
  });
  html += '</div>';

  html += '<div class="qual-card"><div class="qual-title">&#9670; Congestionamento por Persona</div><div class="qual-sub">Índice 0–1, média da janela</div>';
  qAdj.forEach(function(q){
    var p = PERSONA_MAP[q.persona_id];
    html += '<div class="iqre-bar-row"><span class="iqre-seg-lbl">'+q.persona_id+' '+p.nome+'</span>'+
      '<div class="iqre-bar-wrap"><div class="iqre-bar-fill" style="width:'+(q.cong_medio*100)+'%;background:#E87000"></div></div>'+
      '<span class="iqre-val">'+fmtPct(q.cong_medio)+'</span></div>';
  });
  html += '</div>';

  html += '<div class="qual-card"><div class="qual-title">&#9737; IPED médio por Persona</div><div class="qual-sub">Média ponderada do IPED das arestas pelo mix de personas dos nós origem/destino</div>';
  (RAW.iped_by_persona||[]).forEach(function(ip){
    if(ip.iped_medio==null) return;
    var faixa = RAW.iped_faixas.slice().reverse().find(function(f){ return ip.iped_medio>=f.valor_min; }) || RAW.iped_faixas[RAW.iped_faixas.length-1];
    html += '<div class="iqre-bar-row"><span class="iqre-seg-lbl">'+ip.persona_id+' '+ip.persona_nome+'</span>'+
      '<div class="iqre-bar-wrap"><div class="iqre-bar-fill" style="width:'+ip.iped_medio+'%;background:#'+faixa.cor_hex+'"></div></div>'+
      '<span class="iqre-val" style="color:#'+faixa.cor_hex+'">'+ip.iped_medio+' ('+faixa.rotulo+')</span></div>';
  });
  html += '</div>';

  html += '<div class="qual-card"><div class="qual-title">&#9742; Completamento de Voz</div>';
  RAW.quality_by_persona.forEach(function(q){
    var p = PERSONA_MAP[q.persona_id];
    html += '<div class="iqre-bar-row"><span class="iqre-seg-lbl">'+q.persona_id+' '+p.nome+'</span>'+
      '<div class="iqre-bar-wrap"><div class="iqre-bar-fill" style="width:'+(q.completamento_voz_medio*100)+'%;background:#2ECC71"></div></div>'+
      '<span class="iqre-val">'+fmtPct(q.completamento_voz_medio)+'</span><span class="iqre-nsubs">'+fmtN(q.chamadas_total)+' cham.</span></div>';
  });
  html += '</div>';

  html += '<div class="qual-card"><div class="qual-title">&#128241; Completamento de SMS</div>';
  RAW.quality_by_persona.forEach(function(q){
    var p = PERSONA_MAP[q.persona_id];
    html += '<div class="iqre-bar-row"><span class="iqre-seg-lbl">'+q.persona_id+' '+p.nome+'</span>'+
      '<div class="iqre-bar-wrap"><div class="iqre-bar-fill" style="width:'+(q.completamento_sms_medio*100)+'%;background:#1E90FF"></div></div>'+
      '<span class="iqre-val">'+fmtPct(q.completamento_sms_medio)+'</span><span class="iqre-nsubs">'+fmtN(q.mensagens_total)+' sms</span></div>';
  });
  html += '</div>';

  html += '</div>';
  document.getElementById('quality-content').innerHTML = html;
}

/* ══════════════════════════════════════════════════════════════════════
   Alertas de Rede — priorização combinada (porta de NetGraph §5.1 centra-
   lidade/SPOF, §5.3 Bayes ingênuo de causa-raiz, §5.5 score combinado
   gravidade×impacto com CRM/Ouvidoria sintéticos, §7.2 explicabilidade em
   7 seções). Mesma arquitetura e fórmulas do NetGraph (fixo); tabela de
   causas/evidências recalibrada para o domínio móvel (sem fibra/OLT —
   sobrecarga, backhaul, MME, RF legada, energia de site, equipamento
   ativo) porque as causas do NetGraph são específicas de banda fixa e não
   se aplicam a rede móvel. Tudo calculado no navegador sobre RAW já
   embutido (mesmo padrão de Alertas/Rede/Outliers já usado no app). ── */
function seedRng(str){
  var h = 1779033703 ^ str.length;
  for(var i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h<<13) | (h>>>19);
  }
  return function(){
    h = Math.imul(h ^ (h>>>16), 2246822507);
    h = Math.imul(h ^ (h>>>13), 3266489909);
    h ^= h>>>16;
    return (h>>>0)/4294967296;
  };
}
function randInt(rng,lo,hi){ return lo+Math.floor(rng()*(hi-lo+1)); }

/* Árvore Core→PGW→SGW→Site a partir de RAW.topologia_rede (MME fica fora:
   é pool paralelo de controle, não faz parte da hierarquia de dados). */
var REDE_CHILDREN=null, REDE_ALL_IDS=null, _redeSubtreeCache={};
function _redeBuildTree(){
  if(REDE_CHILDREN) return;
  REDE_CHILDREN = {};
  var tr = RAW.topologia_rede;
  REDE_CHILDREN[tr.core.id] = tr.pgw.map(function(p){return p.id;});
  var sgwByPgw = {};
  tr.sgw.forEach(function(s){ (sgwByPgw[s.pgw_upf_id]=sgwByPgw[s.pgw_upf_id]||[]).push(s.id); });
  tr.pgw.forEach(function(p){ REDE_CHILDREN[p.id] = sgwByPgw[p.id]||[]; });
  var sitesBySgw = {};
  tr.sites.forEach(function(s){ (sitesBySgw[s.sgw_id]=sitesBySgw[s.sgw_id]||[]).push(s.id); });
  tr.sgw.forEach(function(s){ REDE_CHILDREN[s.id] = sitesBySgw[s.id]||[]; });
  tr.sites.forEach(function(s){ REDE_CHILDREN[s.id] = []; });
  REDE_ALL_IDS = [tr.core.id].concat(tr.pgw.map(function(p){return p.id;}))
    .concat(tr.sgw.map(function(s){return s.id;})).concat(tr.sites.map(function(s){return s.id;}));
}
function _redeSubtreeIds(id){
  if(_redeSubtreeCache[id]) return _redeSubtreeCache[id];
  var out=[id];
  (REDE_CHILDREN[id]||[]).forEach(function(c){ out=out.concat(_redeSubtreeIds(c)); });
  _redeSubtreeCache[id]=out;
  return out;
}
/* Centralidade (§5.1, mesma fórmula fechada do NetGraph): proxy de
   betweenness numa árvore = tamanho_subárvore(v)×(N−tamanho_subárvore(v)),
   normalizado 0–100 contra o máximo teórico (N/2)². */
function _redeCentralityScore(id){
  _redeBuildTree();
  var below = _redeSubtreeIds(id).length;
  var N = REDE_ALL_IDS.length;
  var raw = below*(N-below);
  var maxRaw = Math.pow(N/2,2);
  return Math.round(1000*raw/maxRaw)/10;
}
/* SPOF: sem dado de redundância de enlace no dataset — todo nó de
   agregação (SGW/PGW) é ponto único de falha por construção; sites são
   folhas (perda de um não isola outros) e MME não entra na árvore. */
function _redeIsSPOF(tipo){ return tipo==='sgw' || tipo==='pgw'; }

function _redeDadosNo(tipo,id){
  var tr = RAW.topologia_rede;
  if(tipo==='site') return tr.sites.filter(function(s){return s.id===id;})[0];
  if(tipo==='sgw') return tr.sgw.filter(function(s){return s.id===id;})[0];
  if(tipo==='pgw') return tr.pgw.filter(function(p){return p.id===id;})[0];
  return null;
}
function _redeRegioesDoNo(tipo,id){
  var tr = RAW.topologia_rede;
  if(tipo==='site'){
    var s = _redeDadosNo('site',id);
    return s && s.area_nome ? [s.area_nome] : [];
  }
  var regs = {};
  tr.sites.forEach(function(s){
    var pertence = tipo==='sgw' ? s.sgw_id===id : s.pgw_upf_id===id;
    if(pertence && s.area_nome) regs[s.area_nome]=true;
  });
  return Object.keys(regs);
}
/* Segmento de alto valor — proxy honesto: o dataset MNO não tem conceito
   de "cliente corporativo com SLA" (isso é do NetGraph/banda fixa). Em
   vez de inventar um campo, usa persona_dominante==='P1' (Executivo
   Mobile, cujos critérios de inclusão já são renda A + flag_flagship) nos
   clusters servidos pelo nó — mesmo papel de "segmento premium" no score
   de impacto, com dado real já existente. */
function _redeSegmentoAltoValor(tipo,id){
  var clusters = {};
  if(tipo==='site'){
    var s = _redeDadosNo('site',id);
    if(s) clusters[s.cluster]=true;
  } else {
    RAW.topologia_rede.sites.forEach(function(s){
      if((tipo==='sgw'?s.sgw_id:s.pgw_upf_id)===id) clusters[s.cluster]=true;
    });
  }
  return Object.keys(clusters).some(function(cid){
    var n = RAW.nodes.filter(function(x){return x.id===cid;})[0];
    return n && n.persona_dominante==='P1';
  });
}

/* CRM/Ouvidoria sintéticos por região (mesma técnica do NetGraph §6.2/6.3:
   volume de reclamação por zona, seedado deterministicamente, reforçado
   quando há nó em Crítico/Falha na região — correlação intencional, não
   dado real de CRM). Usado só no eixo de impacto de negócio do score. */
var CRM_MNO=null;
function _crmBuild(){
  if(CRM_MNO) return;
  CRM_MNO = {};
  var rng = seedRng('journeygraph-mno-crm-2026');
  var tr = RAW.topologia_rede;
  RAW.nodes.forEach(function(n){
    var regiao = n.area_nome;
    var base = {lentidao:randInt(rng,3,18), queda_conexao:randInt(rng,2,14), sem_sinal:randInt(rng,1,9)};
    var ruim = tr.sites.some(function(s){
      if(s.area_nome!==regiao) return false;
      var al = RAW.alertas_rede.site[s.id];
      return al && (al.estado_atual==='Critico' || al.estado_atual==='Falha');
    });
    if(ruim){ base.lentidao+=randInt(rng,8,22); base.queda_conexao+=randInt(rng,6,20); base.sem_sinal+=randInt(rng,3,12); }
    base.total = base.lentidao+base.queda_conexao+base.sem_sinal;
    CRM_MNO[regiao]=base;
  });
}
function _crmForRegiao(regiao){ _crmBuild(); return CRM_MNO[regiao] || {lentidao:0,queda_conexao:0,sem_sinal:0,total:0}; }
function _crmTotalParaNo(tipo,id){
  return _redeRegioesDoNo(tipo,id).reduce(function(s,r){ return s+_crmForRegiao(r).total; }, 0);
}
function _redeOuvidoriaRisk(severidadeMedia, crmTotal){
  var high = crmTotal>=28 && severidadeMedia>=55;
  var medium = crmTotal>=16 && severidadeMedia>=35;
  return {level: high?'alto':medium?'medio':'baixo', crmVolume:crmTotal};
}

function _redeOutlierScoreNode(tipo,id){
  var serie = RAW.series_rede[tipo] && RAW.series_rede[tipo][id];
  if(!serie) return 0;
  var od = robustOutliers(serie.drop_pct), oc = robustOutliers(serie.cong);
  var mx = Math.max(Math.abs(od.lastZ), Math.abs(oc.lastZ));
  return Math.max(0, Math.min(100, Math.round(mx*12)));
}

/* Causas candidatas (§5.3) — recalibradas para rede móvel (não fibra/OLT
   do NetGraph). Priors: distribuição plausível de incidentes num MNO
   regional (não aprendida de dados reais — mesma ressalva do NetGraph). */
var REDE_CAUSES = [
  {id:'sobrecarga_de_rede',  label:'Sobrecarga de rede (congestionamento)', prior:0.20},
  {id:'saturacao_backhaul',  label:'Saturação de backhaul',                 prior:0.16},
  {id:'sinalizacao_mme',     label:'Sinalização MME sobrecarregada',        prior:0.10},
  {id:'cobertura_rf_legada', label:'Cobertura RF legada (WCDMA/3G)',        prior:0.18},
  {id:'falha_energia_site',  label:'Falha de energia/backup no site',       prior:0.16},
  {id:'falha_equipamento',   label:'Falha de equipamento ativo (BBU/RRU)',  prior:0.20},
];
/* Likelihood P(evidência=presente|causa) — 8 evidências binárias, mesma
   estrutura do NetGraph (SPOF, blast pequeno/grande, outlier de
   qualidade, queda de tráfego, nível do nó) adaptada ao domínio móvel. */
var REDE_CAUSE_LIKELIHOOD = {
  sobrecarga_de_rede:   {isSpof:0.20, singleSite:0.35, dropOut:0.55, congOut:0.90, trafQueda:0.05, wideBlast:0.45, siteLvl:0.55, agregLvl:0.45},
  saturacao_backhaul:   {isSpof:0.45, singleSite:0.30, dropOut:0.75, congOut:0.60, trafQueda:0.15, wideBlast:0.65, siteLvl:0.35, agregLvl:0.70},
  sinalizacao_mme:      {isSpof:0.15, singleSite:0.20, dropOut:0.70, congOut:0.30, trafQueda:0.10, wideBlast:0.75, siteLvl:0.40, agregLvl:0.55},
  cobertura_rf_legada:  {isSpof:0.05, singleSite:0.80, dropOut:0.85, congOut:0.25, trafQueda:0.05, wideBlast:0.10, siteLvl:0.90, agregLvl:0.05},
  falha_energia_site:   {isSpof:0.55, singleSite:0.45, dropOut:0.60, congOut:0.20, trafQueda:0.90, wideBlast:0.50, siteLvl:0.60, agregLvl:0.45},
  falha_equipamento:    {isSpof:0.50, singleSite:0.55, dropOut:0.80, congOut:0.35, trafQueda:0.65, wideBlast:0.30, siteLvl:0.65, agregLvl:0.40},
};
function _redeEvidencia(tipo,id){
  var serie = RAW.series_rede[tipo] && RAW.series_rede[tipo][id];
  var dd = _redeDadosNo(tipo,id);
  var nSites = dd ? (dd.n_sites!=null?dd.n_sites:1) : 1;
  var subs = dd ? (dd.n_usuarios_est||0) : 0;
  var dropOut=false, congOut=false, trafQueda=false;
  if(serie){
    dropOut = robustOutliers(serie.drop_pct).isOutlierNow;
    congOut = robustOutliers(serie.cong).isOutlierNow;
    if(serie.trafego_gb && serie.trafego_gb.length>=6){
      var t = serie.trafego_gb, half = Math.floor(t.length/2);
      var baseline = t.slice(0,half).reduce(function(a,b){return a+b;},0)/half;
      trafQueda = t[t.length-1] < baseline*0.5;
    }
  }
  return {
    isSpof: _redeIsSPOF(tipo), singleSite: nSites<=1,
    dropOut: dropOut, congOut: congOut, trafQueda: trafQueda,
    wideBlast: nSites>=20 || subs>=3000,
    siteLvl: tipo==='site', agregLvl: tipo==='sgw'||tipo==='pgw',
  };
}
function _redeBayesCauses(tipo,id){
  var ev = _redeEvidencia(tipo,id);
  var posts = REDE_CAUSES.map(function(c){
    var lk = REDE_CAUSE_LIKELIHOOD[c.id], p = c.prior;
    Object.keys(lk).forEach(function(k){ p *= ev[k] ? lk[k] : (1-lk[k]); });
    return {id:c.id, label:c.label, raw:p};
  });
  var total = posts.reduce(function(s,p){return s+p.raw;},0) || 1e-9;
  posts.forEach(function(p){ p.prob = p.raw/total; });
  posts.sort(function(a,b){return b.prob-a.prob;});
  return {posterior:posts, evidence:ev, top:posts[0]};
}

function _redeStateScoreVal(estado){ return {Saudavel:0, Degradado:35, Critico:70, Falha:100}[estado]||0; }

/* Score combinado (§5.5): gravidade técnica (estado 40% + Markov 25% +
   outlier 20% + SPOF 15%) e impacto de negócio (assinantes log-escala 40%
   + segmento alto valor 20% + CRM 20% + Ouvidoria 20%); score final =
   média simples dos dois — mesmos pesos e mesma fórmula do NetGraph. */
function _redeAlertScore(tipo,id){
  var al = RAW.alertas_rede[tipo][id];
  var stateScore = _redeStateScoreVal(al.estado_atual);
  var outlier = _redeOutlierScoreNode(tipo,id);
  var spof = _redeIsSPOF(tipo);
  var gravidade = Math.max(0, Math.min(100, Math.round(
    stateScore*0.40 + al.p_piora*100*0.25 + outlier*0.20 + (spof?100:0)*0.15)));

  var dd = _redeDadosNo(tipo,id);
  var subs = dd ? (dd.n_usuarios_est||0) : 0;
  var subsNorm = Math.min(100, Math.round(100*Math.log(1+subs)/Math.log(1+15000)));
  var altoValor = _redeSegmentoAltoValor(tipo,id);
  var crmTotal = _crmTotalParaNo(tipo,id);
  var crmNorm = Math.min(100, Math.round(100*crmTotal/60));
  var ouv = _redeOuvidoriaRisk(Math.round((stateScore+outlier)/2), crmTotal);
  var ouvScore = {alto:100, medio:55, baixo:15}[ouv.level];
  var impacto = Math.max(0, Math.min(100, Math.round(
    subsNorm*0.40 + (altoValor?100:0)*0.20 + crmNorm*0.20 + ouvScore*0.20)));

  var score = Math.round(gravidade*0.5 + impacto*0.5);
  return {gravidade:gravidade, impacto:impacto, score:score, outlier:outlier, spof:spof, subs:subs,
    regioes:_redeRegioesDoNo(tipo,id), altoValor:altoValor, crmTotal:crmTotal, ouvidoria:ouv,
    centralidade:_redeCentralityScore(id)};
}

function _redeBuildAlerts(){
  _redeBuildTree();
  /* Critério de candidato: NetGraph usa health!=="saudavel" OR outlier alto,
     mas nesta base "Crítico" virou o estado típico do último dia da janela
     (efeito da deriva orgânica de 15 dias acumulada — ver metodologia de
     alertas_rede) — usar "!==Saudavel" sozinho tornaria praticamente todo
     nó "candidato", o que não prioriza nada. Em vez disso: Falha sempre
     entra (pior estado); Crítico só entra se também tiver outlier robusto
     (sinal adicional de anormalidade, não só o patamar já esperado da
     janela); outlier muito alto entra em qualquer estado. */
  var out = [];
  ['site','sgw','pgw'].forEach(function(tipo){
    Object.keys(RAW.alertas_rede[tipo]).forEach(function(id){
      var al = RAW.alertas_rede[tipo][id];
      var outlier = _redeOutlierScoreNode(tipo,id);
      var candidato = al.estado_atual==='Falha' || outlier>=55 ||
        (al.estado_atual==='Critico' && outlier>=42);
      if(candidato){
        var sc = _redeAlertScore(tipo,id);
        out.push({id:'AL-'+id, tipo:tipo, nodeId:id, estado:al.estado_atual, pPiora:al.p_piora,
          bayes:_redeBayesCauses(tipo,id), score:sc});
      }
    });
  });
  out.sort(function(a,b){ return b.score.score - a.score.score; });
  return out;
}

function _redeAcaoRecomendada(causaId){
  var acts = {
    sobrecarga_de_rede: 'Avaliar balanceamento de carga entre setores/antenas vizinhas e priorização de tráfego por QCI; monitorar se persiste em horário de pico.',
    saturacao_backhaul: 'Verificar capacidade do enlace de backhaul (fibra/micro-ondas) do SGW/PGW e avaliar upgrade — ver projeção de saturação na aba Rede.',
    sinalizacao_mme: 'Checar carga de sinalização (attach/handover) no pool de MME/AMF associado e avaliar redistribuição entre instâncias do pool.',
    cobertura_rf_legada: 'Inspecionar antena/setor para degradação de RF; avaliar prioridade de migração de tráfego legado (WCDMA/3G) para LTE/5G neste site.',
    falha_energia_site: 'Acionar equipe de campo para verificar energia comercial/bateria/gerador do site — priorizar por SPOF e assinantes afetados.',
    falha_equipamento: 'Acionar NOC para diagnóstico remoto do equipamento ativo (BBU/RRU) e, se necessário, abrir chamado com fornecedor.',
  };
  return (acts[causaId]||'Encaminhar ao NOC para triagem.') + ' (Nível 1 semi-automático — mesmo padrão de encaminhamento do JourneyGraph.)';
}
function _redeNarrativa(a){
  var anatelNota = (a.estado==='Critico'||a.estado==='Falha')
    ? ' Esse padrão de degradação prolongada, se não resolvido dentro do prazo de reparo aplicável, pode se relacionar aos indicadores de qualidade do Serviço Móvel Pessoal (SMP) da Anatel.'
    : '';
  return 'O elemento '+a.nodeId+' está classificado como '+a.estado+', com '+Math.round(a.bayes.top.prob*100)+
    '% de probabilidade posterior para a causa "'+a.bayes.top.label+'" (rede Bayesiana) e '+Math.round(a.pPiora*100)+
    '% de chance de piorar na próxima observação diária (Markov). Afeta ~'+fmtN(Math.round(a.score.subs))+' assinante(s)'+
    (a.score.altoValor?', incluindo área de alta concentração do perfil Executivo Mobile':'')+
    '. Score de prioridade '+a.score.score+'/100.'+anatelNota;
}

var _alertsView = 'persona';
var _redeAlertsCache = null;
var _redeAlertSelected = null;
function _alertsSetView(v){
  _alertsView = v;
  document.querySelectorAll('.alerts-view-tab').forEach(function(b,i){
    b.classList.toggle('active', (v==='persona'&&i===0) || (v==='rede'&&i===1));
  });
  renderAlerts();
}

/* ── Alertas (Bayes/Markov por persona) ──────────────────────────── */
var _alertSelectedPersona = null;
function renderAlerts(){
  if(_alertsView==='rede'){ _renderAlertsRede(); return; }
  var html = '';
  RAW.personas.forEach(function(p){
    var mk = RAW.alerts.markov[p.id];
    var color = ESTADO_COLOR[mk.estado_atual];
    html += '<div class="alert-card" style="border-left-color:'+color+'" onclick="_selectAlertPersona(\''+p.id+'\')" id="alert-card-'+p.id+'">'+
      '<div class="alert-head"><div class="alert-title">'+p.id+' · '+p.nome+'</div>'+
      '<span class="alert-state" style="background:'+color+'22;color:'+color+';border:1px solid '+color+'">'+mk.estado_atual+'</span></div>'+
      '<div class="alert-body">P(piora nas próximas observações) = <b style="color:#E87000">'+fmtPct(mk.p_piora)+'</b> · '+
      fmtN(mk.n_transicoes_observadas)+' transições diárias observadas nesta execução.</div>'+
      '<div class="alert-sec">Matriz de transição (Markov, contada da série real)</div>'+
      _markovTable(mk)+
      '</div>';
  });
  document.getElementById('alerts-content').innerHTML = html;
  _selectAlertPersona(RAW.personas[0].id);
}
function _markovTable(mk){
  var h = '<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:10px"><tr><td></td>';
  mk.estados.forEach(function(e){ h+='<td style="padding:2px 4px;color:#567898;text-align:center">'+e.slice(0,4)+'</td>'; });
  h += '</tr>';
  mk.estados.forEach(function(a){
    h += '<tr><td style="padding:2px 4px;color:#8ABEDF;white-space:nowrap">'+a.slice(0,4)+'</td>';
    mk.estados.forEach(function(b){
      var v = mk.matriz_transicao[a][b];
      var bg = v>0 ? 'rgba(232,112,0,'+(0.15+v*0.5)+')' : 'transparent';
      h += '<td style="padding:2px 4px;text-align:center;background:'+bg+'">'+(v?v.toFixed(2):'—')+'</td>';
    });
    h += '</tr>';
  });
  h += '</table></div>';
  return h;
}
function _selectAlertPersona(pid){
  _alertSelectedPersona = pid;
  document.querySelectorAll('.alert-card').forEach(function(c){ c.style.opacity = c.id==='alert-card-'+pid?'1':'0.6'; });
  var p = PERSONA_MAP[pid];
  var mk = RAW.alerts.markov[pid];
  var by = RAW.alerts.bayes[pid];
  var q = RAW.quality_by_persona.filter(function(x){return x.persona_id===pid;})[0];

  var html = '<div style="font-size:13px;font-weight:700;color:#F0F8FF;margin-bottom:10px">Explicabilidade — '+pid+' '+p.nome+'</div>';

  html += '<div class="alert-sec">1. O quê</div><div class="alert-body">Taxa de drop média = '+fmtPct(q.drop_medio)+
    ', estado de severidade atual: <b style="color:'+ESTADO_COLOR[mk.estado_atual]+'">'+mk.estado_atual+'</b> (limiar de referência: 5%/8%/12%).</div>';

  html += '<div class="alert-sec">2. Por quê (causa provável — Bayes)</div>';
  by.causas.forEach(function(c){
    html += '<div class="bayes-row"><span class="bayes-lbl">'+c.nome+'</span>'+
      '<div class="bayes-bar-wrap"><div class="bayes-bar-fill" style="width:'+(c.posterior*100)+'%"></div></div>'+
      '<span class="bayes-val">'+fmtPct(c.posterior)+'</span></div>';
  });
  html += '<div style="font-size:10px;color:#3A6080;margin-top:4px">Posterior calculado por correlação real entre séries diárias (evidência), não rótulo fixo. Amostra pequena — tratar como ilustrativo.</div>';

  html += '<div class="alert-sec">3. Para onde (tendência — Markov)</div><div class="alert-body">P(piorar de '+mk.estado_atual+' para um estado pior) = <b style="color:#E87000">'+fmtPct(mk.p_piora)+'</b></div>';

  // Cluster com maior contagem ABSOLUTA da persona (não "cluster dominado
  // por ela" — com 4 personas quase equidistribuídas, uma so persona
  // (a de maior participação geral) tende a vencer a pluralidade na
  // maioria dos clusters, o que tornaria esse número artificialmente
  // pequeno para as demais personas).
  var nodeTop = RAW.nodes.slice().sort(function(a,b){ return (b.mix[pid]||0)-(a.mix[pid]||0); })[0];
  var nDominados = RAW.nodes.filter(function(n){return n.persona_dominante===pid;}).length;
  html += '<div class="alert-sec">4. Quem é afetado</div><div class="alert-body">'+fmtN(p.n)+' assinantes na persona '+pid+
    (nodeTop? ' · maior concentração absoluta: '+(nodeTop.area_nome||nodeTop.id)+' ('+fmtN(nodeTop.mix[pid]||0)+' assinantes desta persona)':'')+
    ' · persona majoritária em '+nDominados+' de '+RAW.nodes.length+' clusters. Nunca assinante individual fora da Consulta Individual restrita.</div>';

  html += '<div class="alert-sec">5. Prioridade</div><div class="alert-body">Gravidade técnica ('+mk.estado_atual+', P(piora)='+fmtPct(mk.p_piora)+') × impacto de negócio ('+fmtN(p.n)+' assinantes, '+fmtPct(p.pct/100)+' da base).</div>';

  html += '<div class="alert-sec">6. O que fazer</div><div class="alert-body">Encaminhamento Nível 1 (semi-automático): priorizar investigação de causa técnica com maior posterior acima, cruzando com CRM/NOC quando disponível.</div>';

  html += '<div class="alert-sec">7. Narrativa</div><div class="alert-body" style="font-style:italic">"Entre as 4 personas móveis, '+pid+' ('+p.nome+') está em estado '+mk.estado_atual+
    ' com '+fmtN(p.n)+' assinantes. A causa mais provável apontada pela evidência correlacional é '+ (by.causas.slice().sort(function(a,b){return b.posterior-a.posterior;})[0].nome) +'."</div>';

  document.getElementById('alerts-side').innerHTML = html;
}

function _renderAlertsRede(){
  var lista = _redeAlertsCache = _redeBuildAlerts();
  var html = '<div style="font-size:11px;color:#567898;margin-bottom:10px">'+
    '&#9888; '+lista.length+' alerta(s) priorizado(s) por score combinado de gravidade técnica × impacto de negócio (mesma fórmula do NetGraph, §5.5). Candidatos: nós em Falha, ou em Crítico com outlier robusto adicional (score MAD ≥42/100), ou outlier muito alto (≥55/100) em qualquer estado. Cada alerta é explicável em 7 dimensões: o quê, por quê (Bayes), tendência (Markov), quem é afetado (blast radius), por que essa prioridade, o que fazer, narrativa.</div>';
  if(!lista.length){
    html += '<div style="font-size:12px;color:#3A6080">Nenhum nó de rede atingiu o limiar de alerta nesta execução.</div>';
  }
  lista.forEach(function(a, i){
    var color = REDE_ESTADO_COLOR[a.estado];
    var scoreColor = a.score.score>=70 ? '#FF4444' : a.score.score>=45 ? '#E87000' : '#E8B000';
    html += '<div class="rede-alert-row" id="rede-alert-row-'+a.id+'" onclick="_redeAlertSelect(\''+a.id+'\')">'+
      '<div class="rede-alert-rank">#'+(i+1)+'</div>'+
      '<div class="rede-alert-score" style="color:'+scoreColor+'">'+a.score.score+'</div>'+
      '<div class="rede-alert-main"><div class="rede-alert-id">'+a.nodeId+' <span class="alert-state" style="background:'+color+'22;color:'+color+';border:1px solid '+color+'">'+a.estado+'</span></div>'+
      '<div class="rede-alert-sub">'+a.tipo.toUpperCase()+(a.score.spof?' · SPOF':'')+' · '+fmtN(Math.round(a.score.subs))+' assinantes · causa provável: '+a.bayes.top.label+' ('+Math.round(a.bayes.top.prob*100)+'%)</div></div>'+
      '</div>';
  });
  document.getElementById('alerts-content').innerHTML = html;
  if(lista.length) _redeAlertSelect(lista[0].id);
  else document.getElementById('alerts-side').innerHTML = '';
}
function _redeAlertSelect(alertId){
  _redeAlertSelected = alertId;
  document.querySelectorAll('.rede-alert-row').forEach(function(r){ r.classList.toggle('active', r.id==='rede-alert-row-'+alertId); });
  var a = (_redeAlertsCache||[]).filter(function(x){return x.id===alertId;})[0];
  if(!a) return;
  var al = RAW.alertas_rede[a.tipo][a.nodeId];
  var color = REDE_ESTADO_COLOR[a.estado];

  var html = '<div style="font-size:13px;font-weight:700;color:#F0F8FF;margin-bottom:10px">Explicabilidade — '+a.nodeId+' ('+a.tipo.toUpperCase()+')</div>';

  html += '<div class="alert-sec">1. O quê</div><div class="alert-body">Nó '+a.nodeId+' ('+a.tipo.toUpperCase()+
    (a.score.regioes.length ? ', '+a.score.regioes.slice(0,2).join('; ')+(a.score.regioes.length>2?'…':'') : '')+
    ') está em estado <b style="color:'+color+'">'+a.estado+'</b>'+
    (a.score.outlier>=42 ? ' — padrão estatisticamente atípico (outlier robusto MAD, score '+a.score.outlier+'/100)' : '')+'.</div>';

  html += '<div class="alert-sec">2. Por quê (causa provável — rede Bayesiana)</div>';
  a.bayes.posterior.slice(0,4).forEach(function(p){
    html += '<div class="bayes-row"><span class="bayes-lbl">'+p.label+'</span>'+
      '<div class="bayes-bar-wrap"><div class="bayes-bar-fill" style="width:'+(p.prob*100)+'%"></div></div>'+
      '<span class="bayes-val">'+fmtPct(p.prob)+'</span></div>';
  });
  var evOn = Object.keys(a.bayes.evidence).filter(function(k){return a.bayes.evidence[k];});
  var evOff = Object.keys(a.bayes.evidence).filter(function(k){return !a.bayes.evidence[k];});
  html += '<div style="font-size:10px;color:#3A6080;margin-top:4px">Evidências a favor: '+(evOn.join(', ')||'nenhuma')+'. Evidências descartadas: '+(evOff.join(', ')||'nenhuma')+'. Naive Bayes com priors + 8 evidências binárias — tabela plausível, não aprendida de dados reais.</div>';

  html += '<div class="alert-sec">3. Para onde (tendência — Markov)</div><div class="alert-body">P(piorar de '+a.estado+' para um estado pior na próxima observação diária) = <b style="color:#E87000">'+fmtPct(a.pPiora)+'</b>, estimada pela matriz de transição contada da série real deste nó ('+fmtN(al.n_transicoes_observadas)+' transições observadas).</div>';

  html += '<div class="alert-sec">4. Quem é afetado (blast radius)</div><div class="alert-body">~'+fmtN(Math.round(a.score.subs))+' assinante(s) downstream'+
    (a.score.regioes.length ? ', região(ões): '+a.score.regioes.join(', ') : '')+
    (a.score.altoValor ? '. Inclui cluster de alta concentração do perfil P1 Executivo Mobile (proxy de segmento premium, sem dado de cliente corporativo no MNO)' : '')+'.'+
    (a.score.spof ? ' Este elemento é <b style="color:#FF4444">ponto único de falha (SPOF)</b> — sem caminho redundante modelado.' : '')+'</div>';

  html += '<div class="alert-sec">5. Por que essa prioridade</div>';
  html += '<div class="rede-score-split">';
  html += '<div class="rede-score-split-item"><div class="rede-score-split-lbl"><span>Gravidade técnica</span><span>'+a.score.gravidade+'/100</span></div><div class="score-bar-wrap"><div class="score-bar-fill" style="width:'+a.score.gravidade+'%;background:#E84040"></div></div><div class="rede-score-split-cap">estado(40%) + Markov(25%) + outlier(20%) + SPOF(15%)</div></div>';
  html += '<div class="rede-score-split-item"><div class="rede-score-split-lbl"><span>Impacto de negócio</span><span>'+a.score.impacto+'/100</span></div><div class="score-bar-wrap"><div class="score-bar-fill" style="width:'+a.score.impacto+'%;background:#60C0FF"></div></div><div class="rede-score-split-cap">assinantes(40%) + segmento premium(20%) + CRM(20%) + Ouvidoria(20%)</div></div>';
  html += '</div>';
  html += '<div style="margin-top:6px;font-size:11px;color:#8ABEDF">Score combinado = 0,5×gravidade + 0,5×impacto = <b style="color:'+(a.score.score>=70?'#FF4444':a.score.score>=45?'#E87000':'#E8B000')+'">'+a.score.score+'</b> · Centralidade estrutural: '+a.score.centralidade+'/100 · CRM: '+a.score.crmTotal+' reclamação(ões) sintética(s) correlacionada(s) na região · Risco de escalonamento à Ouvidoria/Anatel: <b>'+a.score.ouvidoria.level+'</b>.</div>';

  html += '<div class="alert-sec">6. O que fazer</div><div class="alert-body">'+_redeAcaoRecomendada(a.bayes.top.id)+'</div>';

  html += '<div class="alert-sec">7. Narrativa</div><div class="alert-body" style="font-style:italic">"'+_redeNarrativa(a)+'"</div>';

  document.getElementById('alerts-side').innerHTML = html;
}

/* ── Assistente (RAG mock por palavras-chave, mesmo padrão do JourneyGraph ISP) ── */
function renderAssistant(){
  var html = '<div class="asst-suggest">';
  ['Como são calculadas as personas?','O que é causa provável de um alerta?','Que operadora é essa base?','Como funciona a Consulta Individual?','O que é RAT?','O que é Vamping?','Por que Streamer e Gamer são personas separadas?'].forEach(function(q){
    html += '<button class="asst-sugg-btn" onclick="_asstAsk(\''+q.replace(/'/g,"\\'")+'\')">'+q+'</button>';
  });
  html += '</div><div class="asst-log" id="asst-log"><div class="asst-msg bot">Olá! Sou o Assistente do JourneyGraph MNO Edition. Pergunte sobre metodologia, personas, indicadores ou dados. Este é um RAG mock por palavras-chave sobre um corpus estático — não um LLM real.</div></div>'+
    '<div class="asst-input-row"><input id="asst-input" placeholder="Pergunte algo..." onkeydown="if(event.key===\'Enter\')_asstSend()"><button onclick="_asstSend()">Enviar</button></div>';
  document.getElementById('assistant-content').innerHTML = html;
}
function _asstSend(){
  var inp = document.getElementById('asst-input');
  var q = inp.value.trim();
  if(!q) return;
  inp.value='';
  _asstAsk(q);
}
function _asstAsk(q){
  var log = document.getElementById('asst-log');
  log.innerHTML += '<div class="asst-msg user">'+q+'</div>';
  var qn = q.toLowerCase();
  var best = null, bestScore = 0;
  RAW.assistant_corpus.forEach(function(d){
    var score = 0;
    (d.titulo+' '+d.texto).toLowerCase().split(/\s+/).forEach(function(w){
      if(w.length>3 && qn.indexOf(w)>-1) score++;
    });
    qn.split(/\s+/).forEach(function(w){
      if(w.length>3 && (d.titulo+d.texto).toLowerCase().indexOf(w)>-1) score++;
    });
    if(score>bestScore){ bestScore=score; best=d; }
  });
  var resp;
  if(best && bestScore>0){
    resp = best.texto + '<div class="asst-cite">Fonte: '+best.titulo+' · '+best.fonte+'</div>';
  } else {
    resp = 'Não encontrei conteúdo específico no corpus para essa pergunta. Tente mencionar: personas, causa provável, operadora, RAT, LGPD, Consulta Individual.';
  }
  log.innerHTML += '<div class="asst-msg bot">'+resp+'</div>';
  log.scrollTop = log.scrollHeight;
}

/* ── Consulta Individual (restrita) ──────────────────────────────── */
var _rstUnlocked = false;
var _rstAuditLog = [];
function renderRestricted(){
  if(!_rstUnlocked){
    document.getElementById('restricted-overlay').style.display='flex';
    document.getElementById('restricted-content').innerHTML='';
    return;
  }
  _rstShowSearch();
}
function _rstSubmit(){
  var pass = document.getElementById('rst-pass').value;
  var motivo = document.getElementById('rst-motivo').value;
  if(pass !== 'demo123'){
    document.getElementById('rst-err').style.display='block';
    return;
  }
  _rstUnlocked = true;
  _rstAuditLog.push({ ts:new Date().toLocaleString('pt-BR'), acao:'Login', motivo:motivo });
  document.getElementById('restricted-overlay').style.display='none';
  _rstShowSearch();
}
function _rstCancel(){
  switchScreen('overview');
}
function _rstShowSearch(){
  var html = '<div class="rst-banner">&#9888; Consulta ativa — todo acesso é registrado. Sigilo das telecomunicações. Não compartilhar dados individuais fora do processo que autorizou este acesso.</div>'+
    '<div class="rst-search"><input id="rst-hash-input" placeholder="assinante_hash (ex: 1..15000)"><button onclick="_rstSearch()">Buscar</button><button class="rst-random" onclick="_rstRandom()">Aleatório</button></div>'+
    '<div id="rst-result"></div>'+
    '<div class="ins-title" style="margin-top:20px">Log de auditoria (sessão)</div><table class="rst-audit-table" style="margin-top:6px"><thead><tr><th>Quando</th><th>Ação</th><th>Motivo</th></tr></thead><tbody id="rst-audit-body"></tbody></table>';
  document.getElementById('restricted-content').innerHTML = html;
  _rstRenderAudit();
}
function _rstRenderAudit(){
  var body = document.getElementById('rst-audit-body');
  if(!body) return;
  body.innerHTML = _rstAuditLog.slice().reverse().map(function(a){
    return '<tr><td>'+a.ts+'</td><td>'+a.acao+'</td><td>'+a.motivo+'</td></tr>';
  }).join('');
}
function _rstSearch(){
  var h = parseInt(document.getElementById('rst-hash-input').value, 10);
  var rec = RAW.restricted_sample.filter(function(r){ return r.h===h; })[0];
  if(!rec){ document.getElementById('rst-result').innerHTML = '<div style="color:#FF6B5B;font-size:12px">assinante_hash não encontrado na amostra.</div>'; return; }
  _rstShowProfile(rec);
}
function _rstRandom(){
  var rec = RAW.restricted_sample[Math.floor(Math.random()*RAW.restricted_sample.length)];
  _rstShowProfile(rec);
}
function _rstShowProfile(rec){
  _rstAuditLog.push({ ts:new Date().toLocaleString('pt-BR'), acao:'Consulta assinante_hash='+rec.h, motivo:document.getElementById('rst-motivo')?document.getElementById('rst-motivo').value:'—' });
  var p = PERSONA_MAP[rec.p];
  var html = '<div class="rst-profile">'+
    '<div class="rst-profile-row"><span class="k">assinante_hash</span><span class="v">'+rec.h+'</span></div>'+
    '<div class="rst-profile-row"><span class="k">Persona</span><span class="v">'+rec.p+' · '+p.nome+' (confiança '+fmtPct(rec.c)+')</span></div>'+
    '<div class="rst-profile-row"><span class="k">Cluster residencial</span><span class="v">'+rec.cl+'</span></div>'+
    '<div class="rst-profile-row"><span class="k">Renda / Idade</span><span class="v">'+rec.inc+' / '+rec.age+'</span></div>'+
    '<div class="rst-profile-row"><span class="k">Padrão de mobilidade</span><span class="v">'+rec.mob+'</span></div>'+
    '<div class="rst-profile-row"><span class="k">Dispositivo flagship</span><span class="v">'+(rec.flag?'Sim':'Não')+'</span></div>'+
    '<div class="rst-profile-row"><span class="k">Download total (janela)</span><span class="v">'+rec.dl.toFixed(2)+' GB</span></div>'+
    '<div class="rst-profile-row"><span class="k">Drop médio</span><span class="v">'+fmtPct(rec.drop)+'</span></div>'+
    '<div class="rst-profile-row"><span class="k">Chamadas / SMS (total)</span><span class="v">'+fmtN(rec.call)+' / '+fmtN(rec.sms)+'</span></div>'+
    '<div class="rst-profile-row"><span class="k">Dias ativos</span><span class="v">'+rec.dias+' / '+RAW.metadata.n_days+'</span></div>'+
    (rec.vamp ? '<div class="rst-profile-row"><span class="k">Vamping</span><span class="v">'+rec.vamp.score+'/100'+(rec.vamp.flag?' · flag ativo':'')+'</span></div>' : '')+
    '</div>';
  document.getElementById('rst-result').innerHTML = html;
  _rstRenderAudit();
}

/* ── Init ─────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.nav-btn[data-screen]').forEach(function(b){
    b.addEventListener('click', function(){ switchScreen(b.getAttribute('data-screen')); });
  });
  buildPersonaFilter();
  buildIpedFilter();
  buildClusterFilter();
  buildDiaPeriodoFilter();
  _updatePeopleParamsSummary();
  renderOverview();
  window.addEventListener('resize', function(){ if(S.screen==='graph') renderGraph(); });

  var minInp = document.getElementById('edge-min-input');
  var maxInp = document.getElementById('edge-max-input');
  minInp.addEventListener('input', function(){
    S.edgeMin = minInp.value===''? null : Math.max(0, parseInt(minInp.value,10));
    _refreshCurrentScreen();
  });
  maxInp.addEventListener('input', function(){
    S.edgeMax = maxInp.value===''? null : Math.max(0, parseInt(maxInp.value,10));
    _refreshCurrentScreen();
  });
  document.getElementById('edge-filter-clear-btn').addEventListener('click', function(){
    minInp.value=''; maxInp.value='';
    S.edgeMin=null; S.edgeMax=null;
    _refreshCurrentScreen();
  });

  var nodeMinInp = document.getElementById('node-min-input');
  var nodeMaxInp = document.getElementById('node-max-input');
  nodeMinInp.addEventListener('input', function(){
    S.nodeMin = nodeMinInp.value===''? null : Math.max(0, parseInt(nodeMinInp.value,10));
    _refreshCurrentScreen();
  });
  nodeMaxInp.addEventListener('input', function(){
    S.nodeMax = nodeMaxInp.value===''? null : Math.max(0, parseInt(nodeMaxInp.value,10));
    _refreshCurrentScreen();
  });
});
