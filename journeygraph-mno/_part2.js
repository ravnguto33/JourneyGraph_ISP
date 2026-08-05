
var S = { screen: 'overview', personaFilter: 'all', edgeMin: null, edgeMax: null, ipedFaixas: null };

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
  if(name==='rgjourney') renderRGJourney();
  if(name==='rede') renderRede();
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

  html += '<div class="ins-card"><div class="ins-title">&#127772; Vamping (exposição noturna a telas)</div>'+
    '<div class="ins-big">'+RAW.vamping.resumo.score_medio+'<span style="font-size:16px;color:#567898">/100</span></div>'+
    '<div class="ins-sub">score médio · '+fmtPct(RAW.vamping.resumo.pct_flag/100)+' dos assinantes com uso frequente na madrugada (≥4 noites/semana) · p90 = '+RAW.vamping.resumo.p90+'</div>'+
    '<div style="margin-top:8px;font-size:11px;color:#3A6080">Indicador transversal (não é persona) — qualquer uma das 9 personas pode ter vamping alto ou baixo. Ver Personas ou Assistente para metodologia.</div></div>';

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
    .filter(function(e){
      return (S.edgeMin==null || e.n_usuarios >= S.edgeMin) &&
             (S.edgeMax==null || e.n_usuarios <= S.edgeMax) &&
             (!e.iped_faixa || S.ipedFaixas[e.iped_faixa]);
    })
    .map(function(e){ return Object.assign({}, e); });

  var countEl = document.getElementById('edge-filter-count');
  if(countEl) countEl.textContent = fmtN(edges.length)+' de '+fmtN(RAW.edges.length)+' trajetos exibidos';

  var maxEdgeVol = d3.max(edges, function(e){return e.n_usuarios;}) || 1;
  var maxNodeVol = d3.max(nodes, function(n){return n.n_usuarios;}) || 1;
  var rScale = d3.scaleSqrt().domain([0,maxNodeVol]).range([4,26]);
  var wScale = d3.scaleLinear().domain([0,maxEdgeVol]).range([0.6,6]);

  var g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.3,4]).on('zoom', function(ev){ g.attr('transform', ev.transform); }));

  var link = g.append('g').selectAll('line').data(edges).enter().append('line')
    .attr('stroke', function(e){ return e.iped_cor ? '#'+e.iped_cor : '#2A4A6F'; })
    .attr('stroke-opacity', 0.75)
    .attr('stroke-width', function(e){ return wScale(e.n_usuarios); });
  link.append('title').text(function(e){
    return (e.area_origem||e.source)+' → '+(e.area_destino||e.target)+
      '\n'+fmtN(e.n_usuarios)+' pessoas · '+fmtN(e.n_viagens)+' viagens'+
      (e.iped!=null ? '\nIPED: '+e.iped+' ('+e.iped_faixa+')' : '');
  });

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

  var nodeById = {};
  RAW.nodes.forEach(function(n){ nodeById[n.id] = n; });

  // Trajetos (arestas) — mesma origem de dado do Dígrafo (RAW.edges),
  // mas desenhados nas coordenadas geográficas reais em vez do layout de
  // forças. Espessura proporcional ao nº de assinantes que se deslocaram.
  var maxEdgeVol = d3.max(RAW.edges, function(e){return e.n_usuarios;}) || 1;
  var edgeWeight = d3.scaleLinear().domain([0, maxEdgeVol]).range([1, 9]);
  RAW.edges.forEach(function(e){
    var a = nodeById[e.source], b = nodeById[e.target];
    if(!a || !b || a.lat==null || b.lat==null) return;
    var cor = e.iped_cor ? '#'+e.iped_cor : '#E87000';
    var line = L.polyline([[a.lat,a.lon],[b.lat,b.lon]], {
      color: cor,
      weight: edgeWeight(e.n_usuarios),
      opacity: 0.65
    });
    line.bindPopup(
      '<div class="map-popup-title">'+(e.area_origem||a.id)+' &#8594; '+(e.area_destino||b.id)+'</div>'+
      '<div class="map-popup-row">'+fmtN(e.n_usuarios)+' assinantes deslocados · '+fmtN(e.n_viagens)+' viagens</div>'+
      '<div class="map-popup-row">Distância média: '+e.dist_km+' km · período predominante: '+e.periodo_predominante+'</div>'+
      '<div class="map-popup-row">RAT dominante: '+e.rat_dominante+'</div>'+
      (e.iped!=null ? '<div class="map-popup-row"><b>IPED: '+e.iped+' — '+e.iped_faixa+'</b> (qualidade no deslocamento)</div>' : ''),
      { className: 'map-leaflet-tip' }
    );
    line.on('mouseover', function(){ line.setStyle({opacity:0.95, weight: edgeWeight(e.n_usuarios)+2}); });
    line.on('mouseout', function(){ line.setStyle({opacity:0.65, weight: edgeWeight(e.n_usuarios)}); });
    line.addTo(_leafletMap._edgeLayer);
  });

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
  wrap.innerHTML = '<div id="rgj-svg-wrap"><svg id="rgj-svg" viewBox="0 0 560 480"></svg></div><div class="rgj-side" id="rgj-side"></div>';

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
  data.edges.forEach(function(e){
    var a = nodeById[e.source], b = nodeById[e.target];
    if(!a || !b) return;
    var dx=b.x-a.x, dy=b.y-a.y, dist=Math.sqrt(dx*dx+dy*dy);
    var mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    var offset = 18;
    var nx=-dy/dist*offset, ny=dx/dist*offset;
    var pathD = 'M'+a.x+','+a.y+' Q'+(mx+nx)+','+(my+ny)+' '+b.x+','+b.y;
    var ratio = e.n/maxE;
    var baseOpacity = 0.25+ratio*0.55;
    var path = svg.append('path').attr('d', pathD).attr('fill','none')
      .attr('class','rgj-edge')
      .attr('data-source', e.source).attr('data-target', e.target)
      .attr('stroke', RG_COLOR[e.source]).attr('stroke-width', wEdge(e.n))
      .attr('stroke-opacity', baseOpacity).property('_baseOpacity', baseOpacity)
      .attr('marker-end','url(#rgj-arrow)')
      .style('cursor','pointer');
    path.append('title').text(RG_LABEL[e.source]+' → '+RG_LABEL[e.target]+': '+fmtN(e.n)+' transições observadas');
  });

  var nodeSel = svg.selectAll('circle.rgj-node').data(data.nodes).enter().append('circle')
    .attr('class','rgj-node')
    .attr('cx', function(n){return nodeById[n.id].x;})
    .attr('cy', function(n){return nodeById[n.id].y;})
    .attr('r', function(n){return rNode(n.n);})
    .attr('fill', function(n){return RG_COLOR[n.id];})
    .attr('stroke','#050C16').attr('stroke-width',2)
    .style('cursor','pointer')
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

  svg.selectAll('text.rgj-label').data(data.nodes).enter().append('text')
    .attr('class','rgj-label')
    .attr('x', function(n){return nodeById[n.id].x;})
    .attr('y', function(n){return nodeById[n.id].y - rNode(n.n) - 8;})
    .attr('text-anchor','middle').attr('font-size',12).attr('font-weight',700)
    .attr('fill','#D0E8FF').text(function(n){return RG_LABEL[n.id];});

  // Painel lateral: legenda + ranking + nota metodológica
  var side = '<div class="rgj-card"><div class="ins-title" style="margin-bottom:8px">&#128257; Categorias (RG)</div>';
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

  var node = g.selectAll('circle.rede-node').data(h.descendants()).enter().append('circle')
    .attr('class','rede-node')
    .attr('cx', function(d){return d._x;}).attr('cy', function(d){return d._y;})
    .attr('r', function(d){ return d.data.tipo==='site' ? Math.max(2, rScale(d.data.dados.n_usuarios_est||0)*0.5) : rScale(d.data.dados.n_usuarios_est||0)+4; })
    .attr('fill', function(d){ return REDE_COLOR[d.data.tipo]; })
    .attr('stroke','#050C16').attr('stroke-width', function(d){ return d.data.tipo==='site' ? 0.5 : 1.5; })
    .style('cursor','pointer')
    .on('click', function(ev,d){ _redeSelectNode(d); });
  node.append('title').text(function(d){
    var dd = d.data.dados;
    return d.data.id+' ('+d.data.tipo.toUpperCase()+')\n'+fmtN(Math.round(dd.n_usuarios_est||0))+' assinantes (blast radius)'+
      (dd.drop_medio!=null ? '\nDrop: '+fmtPct(dd.drop_medio) : '');
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
  side += '</div>';
  side += '<div class="rgj-card" id="rede-detail"></div>';
  side += '<div class="rgj-card"><div class="ins-title" style="margin-bottom:6px">MME/AMF (controle, pool paralelo)</div>'+
    '<table class="rede-mme-table"><thead><tr><th>MME</th><th>Sites</th><th>Assinantes</th></tr></thead><tbody>';
  tr.mme.forEach(function(m){
    side += '<tr><td>'+m.id+'</td><td>'+fmtN(m.n_sites)+'</td><td>'+fmtN(Math.round(m.n_usuarios_est))+'</td></tr>';
  });
  side += '</tbody></table>'+
    '<div class="rgj-note">'+tr.metodologia+'</div></div>';
  document.getElementById('rede-side').innerHTML = side;

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
  var panel = document.getElementById('rede-detail');
  if(panel) panel.innerHTML = html;
}

/* ── Personas ─────────────────────────────────────────────────────── */
function renderPersonas(){
  var html = '';
  RAW.personas.forEach(function(p){
    var q = RAW.quality_by_persona.filter(function(x){return x.persona_id===p.id;})[0] || {};
    var vamp = RAW.vamping.by_persona.filter(function(x){return x.persona_id===p.id;})[0];
    html += '<div class="pc" style="border-left-color:#'+p.cor_hex+'">'+
      '<div class="pc-head"><div class="pc-avatar" style="background:#'+p.cor_hex+'22;border:1px solid #'+p.cor_hex+'">&#128100;</div>'+
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
  renderOverview();
  window.addEventListener('resize', function(){ if(S.screen==='graph') renderGraph(); });

  var minInp = document.getElementById('edge-min-input');
  var maxInp = document.getElementById('edge-max-input');
  minInp.addEventListener('input', function(){
    S.edgeMin = minInp.value===''? null : Math.max(0, parseInt(minInp.value,10));
    if(S.screen==='graph') renderGraph();
  });
  maxInp.addEventListener('input', function(){
    S.edgeMax = maxInp.value===''? null : Math.max(0, parseInt(maxInp.value,10));
    if(S.screen==='graph') renderGraph();
  });
  document.getElementById('edge-filter-clear-btn').addEventListener('click', function(){
    minInp.value=''; maxInp.value='';
    S.edgeMin=null; S.edgeMax=null;
    if(S.screen==='graph') renderGraph();
  });
});
