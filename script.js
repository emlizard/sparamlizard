    const mu0 = 4 * Math.PI * 1e-7; // 자유공간 투자율
    let dataStore = null;           // 파싱된 데이터 저장
    let Sparams = [];               // ["S11","S21",...,"SNN"]

    document.getElementById('fileInput')
      .addEventListener('change', evt => {
        const file = evt.target.files[0];
        if (!file) return;

        // 확장자에서 포트 개수 N 추출 (e.g. s3p → 3)
        const ext = file.name.split('.').pop().toLowerCase();
        const m = ext.match(/^s(\d+)p$/);
        if (!m) {
          alert("Upload valid sNp file (예: .s2p, .s3p, .s4p).");
          return;
        }
        const N = parseInt(m[1], 10);

        const reader = new FileReader();
        reader.onload = e => {
          setupControls(N);                            // 체크박스 생성
          dataStore = parseTouchstone(e.target.result, N);
          updatePlots();                               // 초기 플롯
        };
        reader.readAsText(file);
      });

    // 동적으로 Sparams 배열과 체크박스 생성
    function setupControls(N) {
      const container = document.getElementById('paramCheckboxes');
      container.innerHTML = '';
      Sparams = [];
      for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= N; j++) {
          const name = `S${i}${j}`;
          Sparams.push(name);
          const chk = document.createElement('input');
          chk.type = 'checkbox';
          chk.id = 'chk' + name;
          chk.checked = true;
          chk.addEventListener('change', updatePlots);

          const lbl = document.createElement('label');
          lbl.appendChild(chk);
          lbl.appendChild(document.createTextNode(' ' + name));
          container.appendChild(lbl);
        }
      }
      document.getElementById('controls').style.display = 'block';
    }

    
    // Touchstone 형식 파싱: N-port, MA/DB/RI 모두 지원
    function parseTouchstone(text, N) {
      const lines = text.split(/\r?\n/);
      let format = null;
      const freq = [];
      const mags = {}, phs = {};
      Sparams.forEach(p => { mags[p]=[]; phs[p]=[]; });

      for (let ln of lines) {
        ln = ln.trim();
        if (!ln || ln.startsWith('!')) continue;
        if (ln.startsWith('#')) {
          // e.g. "# GHz S MA R 50"
          format = ln.split(/\s+/)[3]; 
          continue;
        }
        const vals = ln.split(/\s+/).map(Number);
        // freq + 2*N^2 복소수 쌍이 있어야 함
        if (!format || vals.length < 1 + 2*N*N) continue;
        
        freq.push(vals[0]);
        // 복소수 변환기
        function toC(a,b) {
          if (format === 'RI') return { mag: Math.hypot(a,b), ph: Math.atan2(b,a)*180/Math.PI };
          if (format === 'MA') return { mag: a, ph: b };
          if (format === 'DB') return { mag: Math.pow(10, a/20), ph: b };
          return { mag:0, ph:0 };
        }
        for (let idx = 0; idx < N*N; idx++) {
          const c = toC(vals[1+2*idx], vals[1+2*idx+1]);
          const key = Sparams[idx];
          mags[key].push(20 * Math.log10(c.mag));  // dB
          phs[key].push(c.ph);                    // degrees
        }
      }

      return { freq, mags, phs };
    }

    // 선택된 파라미터만 Plotly.react 로 갱신
    function updatePlots() {
      if (!dataStore) return;
      const { freq, mags, phs } = dataStore;

      // magnitude traces
      const magTraces = [];
      let overallMin = Infinity;
      Sparams.forEach(name => {
        if (document.getElementById('chk'+name).checked) {
          const y = mags[name];
          const curMin = Math.min(...y);
          if (curMin < overallMin) overallMin = curMin;
          magTraces.push({ x: freq, y, name:`${name} (dB)`, mode:'lines' });
        }
      });
      // phase traces
      const phTraces = [];
      Sparams.forEach(name => {
        if (document.getElementById('chk'+name).checked) {
          phTraces.push({ x: freq, y: phs[name], name:`∠${name} (°)`, mode:'lines' });
        }
      });

      // magnitude layout: y축 최대 0, 최소 overallMin
      const magLayout = {
        title: 'Magnitude (dB)',
        xaxis: { title: 'Frequency (GHz)' },
        yaxis: {
          title: '|S| (dB)',
          autorange: false,
          range: [ overallMin, 0 ]
        }
      };
      // phase layout (변경 없음)
      const phLayout = {
        title: 'Phase (°)',
        xaxis: { title: 'Frequency (GHz)' },
        yaxis: { title: '∠S (°)' }
      };

      Plotly.react('magPlot', magTraces, magLayout);
      Plotly.react('phasePlot', phTraces, phLayout);
    }
