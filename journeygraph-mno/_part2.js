
var S = { screen: 'overview', personaFilter: 'all' };

var PERSONA_MAP = {};
RAW.personas.forEach(function(p){ PERSONA_MAP[p.id] = p; });

var ESTADO_COLOR = { Normal:'#2ECC71', Atencao:'#E8B000', Excecao:'#E87000', Critico:'#FF4444' };

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
  if(name==='graph'){ renderMetrics(); renderGraph(); }
  if(name==='map'){ renderMetrics(); renderMap(); }
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
function _setPersonaFilter(pid){
  S.personaFilter = pid;
  document.querySelectorAll('#persona-filter-buttons .fbtn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-p')===pid);
  });
  if(S.screen==='graph') renderGraph();
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

/* ── Visão Geral ──────────────────────────────────────────────────── */
function renderOverview(){
  var m = RAW.metadata;
  var html = '<div class="insights-grid">';

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

  html += '</div>';
  document.getElementById('overview-content').innerHTML = html;
}

/* ── Dígrafo ──────────────────────────────────────────────────────── */
var _simulation = null;
function renderGraph(){
  var svg = d3.select('#graph-svg');
  svg.selectAll('*').remove();
  var el = document.getElementById('screen-graph');
  var w = el.clientWidth, h = el.clientHeight;
  svg.attr('viewBox', [0,0,w,h]);

  var nodes = RAW.nodes.map(function(n){ return Object.assign({}, n); });
  var nodeIds = {}; nodes.forEach(function(n){ nodeIds[n.id]=true; });
  var edges = RAW.edges.filter(function(e){ return nodeIds[e.source] && nodeIds[e.target]; })
    .map(function(e){ return Object.assign({}, e); });

  var maxEdgeVol = d3.max(edges, function(e){return e.n_usuarios;}) || 1;
  var maxNodeVol = d3.max(nodes, function(n){return n.n_usuarios;}) || 1;
  var rScale = d3.scaleSqrt().domain([0,maxNodeVol]).range([4,26]);
  var wScale = d3.scaleLinear().domain([0,maxEdgeVol]).range([0.6,6]);

  var g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.3,4]).on('zoom', function(ev){ g.attr('transform', ev.transform); }));

  var link = g.append('g').selectAll('line').data(edges).enter().append('line')
    .attr('stroke', '#2A4A6F').attr('stroke-opacity', 0.5)
    .attr('stroke-width', function(e){ return wScale(e.n_usuarios); });

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
      .on('start', function(ev,d){ if(!ev.active) _simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
      .on('drag', function(ev,d){ d.fx=ev.x; d.fy=ev.y; })
      .on('end', function(ev,d){ if(!ev.active) _simulation.alphaTarget(0); }))
    .on('mouseover', function(ev,d){
      var tt = document.getElementById('tooltip');
      var mix = Object.keys(d.mix).map(function(k){return k+':'+d.mix[k];}).join(' · ');
      tt.innerHTML = '<b>'+d.id+' · '+(d.area_nome||'—')+'</b><br>'+fmtN(d.n_usuarios)+' assinantes<br>Dominante: '+d.persona_dominante+'<br>Mix: '+mix+
        '<br>Drop médio: '+fmtPct(d.drop_medio)+'<br>Download total: '+fmtN(Math.round(d.download_gb))+' GB';
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
    .on('tick', function(){
      link.attr('x1',function(e){return e.source.x;}).attr('y1',function(e){return e.source.y;})
          .attr('x2',function(e){return e.target.x;}).attr('y2',function(e){return e.target.y;});
      node.attr('cx',function(n){return n.x;}).attr('cy',function(n){return n.y;});
      label.attr('x',function(n){return n.x;}).attr('y',function(n){return n.y;});
    });
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
    _leafletMap._clusterLayer = L.layerGroup().addTo(_leafletMap);
  } else {
    _leafletMap._clusterLayer.clearLayers();
  }

  var maxVol = d3.max(RAW.nodes, function(n){return n.n_usuarios;}) || 1;
  var rScale = d3.scaleSqrt().domain([0,maxVol]).range([5,32]);

  RAW.nodes.forEach(function(n){
    if(n.lat==null || n.lon==null) return;
    var p = PERSONA_MAP[n.persona_dominante];
    var color = p ? '#'+p.cor_hex : '#567898';
    var marker = L.circleMarker([n.lat, n.lon], {
      radius: rScale(n.n_usuarios),
      color: '#050C16', weight: 1.5,
      fillColor: color, fillOpacity: 0.75
    });
    var mix = Object.keys(n.mix).map(function(k){return k+': '+fmtN(n.mix[k]);}).join('<br>');
    marker.bindPopup(
      '<div class="map-popup-title">'+n.id+' · '+(n.area_nome||'Região não identificada')+'</div>'+
      '<div class="map-popup-row">'+fmtN(n.n_usuarios)+' assinantes · dominante: '+n.persona_dominante+'</div>'+
      '<div class="map-popup-row">'+mix+'</div>'+
      '<div class="map-popup-row">Drop médio: '+fmtPct(n.drop_medio)+' · Download: '+fmtN(Math.round(n.download_gb))+' GB</div>',
      { className: 'map-leaflet-tip' }
    );
    marker.addTo(_leafletMap._clusterLayer);
  });

  setTimeout(function(){ _leafletMap.invalidateSize(); }, 80);
}

/* ── Personas ─────────────────────────────────────────────────────── */
function renderPersonas(){
  var html = '';
  RAW.personas.forEach(function(p){
    var q = RAW.quality_by_persona.filter(function(x){return x.persona_id===p.id;})[0] || {};
    html += '<div class="pc" style="border-left-color:#'+p.cor_hex+'">'+
      '<div class="pc-head"><div class="pc-avatar" style="background:#'+p.cor_hex+'22;border:1px solid #'+p.cor_hex+'">&#128100;</div>'+
      '<div><div class="pc-name">'+p.id+' · '+p.nome+'</div><div class="pc-n">'+fmtN(p.n)+' assinantes ('+p.pct+'%) · confiança média '+fmtPct(p.confianca_media)+'</div></div></div>'+
      '<div class="pc-desc">'+p.descricao+'</div>'+
      '<div class="pc-criteria"><b>Inclusão:</b> '+p.criterio_inclusao+'<br><b>Exclusão:</b> '+p.criterio_exclusao+'</div>'+
      '<div class="pc-bar-row"><span class="pc-bar-lbl">Drop médio</span><div class="pc-bar-wrap"><div class="pc-bar-fill" style="width:'+Math.min(100,q.drop_medio*100*6)+'%;background:#FF4444"></div></div><span style="font-size:11px;color:#8ABEDF">'+fmtPct(q.drop_medio||0)+'</span></div>'+
      '<div class="pc-bar-row"><span class="pc-bar-lbl">Download total</span><div class="pc-bar-wrap"><div class="pc-bar-fill" style="width:'+Math.min(100, (q.download_gb_total||0)/100)+'%;background:#1E90FF"></div></div><span style="font-size:11px;color:#8ABEDF">'+fmtN(Math.round(q.download_gb_total||0))+' GB</span></div>'+
      '<div style="margin-top:8px;font-size:11px;color:#567898">Qualidade esperada: '+p.qualidade_rede_esperada+'</div>'+
      '</div>';
  });
  document.getElementById('personas-grid').innerHTML = html;
}

/* ── Qualidade ────────────────────────────────────────────────────── */
function renderQuality(){
  var html = '<div class="qual-grid">';

  html += '<div class="qual-card"><div class="qual-title">&#9670; Taxa de Drop por Persona</div><div class="qual-sub">Threshold de alerta de referência: 8%</div>';
  RAW.quality_by_persona.forEach(function(q){
    var p = PERSONA_MAP[q.persona_id];
    var color = q.drop_medio>0.08 ? '#FF4444' : (q.drop_medio>0.06?'#E87000':'#2ECC71');
    html += '<div class="iqre-bar-row"><span class="iqre-seg-lbl">'+q.persona_id+' '+p.nome+'</span>'+
      '<div class="iqre-bar-wrap"><div class="iqre-bar-fill" style="width:'+Math.min(100,q.drop_medio*100*8)+'%;background:'+color+'"></div></div>'+
      '<span class="iqre-val" style="color:'+color+'">'+fmtPct(q.drop_medio)+'</span></div>';
  });
  html += '</div>';

  html += '<div class="qual-card"><div class="qual-title">&#9670; Congestionamento por Persona</div><div class="qual-sub">Índice 0–1, média da janela</div>';
  RAW.quality_by_persona.forEach(function(q){
    var p = PERSONA_MAP[q.persona_id];
    html += '<div class="iqre-bar-row"><span class="iqre-seg-lbl">'+q.persona_id+' '+p.nome+'</span>'+
      '<div class="iqre-bar-wrap"><div class="iqre-bar-fill" style="width:'+(q.cong_medio*100)+'%;background:#E87000"></div></div>'+
      '<span class="iqre-val">'+fmtPct(q.cong_medio)+'</span></div>';
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

/* ── Alertas (Bayes/Markov por persona) ──────────────────────────── */
var _alertSelectedPersona = null;
function renderAlerts(){
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

/* ── Assistente (RAG mock por palavras-chave, mesmo padrão do JourneyGraph ISP) ── */
function renderAssistant(){
  var html = '<div class="asst-suggest">';
  ['Como são calculadas as personas?','O que é causa provável de um alerta?','Que operadora é essa base?','Como funciona a Consulta Individual?','O que é RAT?'].forEach(function(q){
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
  renderOverview();
  window.addEventListener('resize', function(){ if(S.screen==='graph') renderGraph(); });
});
