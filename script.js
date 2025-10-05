document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 요소 ---
    const fileInput = document.getElementById('fileInput');
    const controlsDiv = document.getElementById('controls');
    const paramCheckboxes = document.getElementById('paramCheckboxes');
    const plotsDiv = document.getElementById('plots');
    const themeToggle = document.getElementById('theme-toggle');
    const fileNameSpan = document.getElementById('fileName');

    // --- 전역 변수 ---
    let dataStore = null;
    let Sparams = [];
    const sunIcon = `☀️`;
    const moonIcon = `🌙`;
    
    // --- 테마 설정 ---
    function setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        themeToggle.innerHTML = theme === 'dark' ? sunIcon : moonIcon;
        localStorage.setItem('theme', theme);
        updatePlots(); // 테마 변경 시 플롯도 업데이트
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        setTheme(currentTheme === 'light' ? 'dark' : 'light');
    });

    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    // --- 파일 입력 이벤트 ---
    fileInput.addEventListener('change', evt => {
        const file = evt.target.files[0];
        if (!file) return;

        fileNameSpan.textContent = `Selected: ${file.name}`;
        const ext = file.name.split('.').pop().toLowerCase();
        const match = ext.match(/^s(\d+)p$/);
        if (!match) {
            alert("Please upload a valid Touchstone file (e.g., .s2p, .s3p).");
            return;
        }
        const N = parseInt(match[1], 10);

        const reader = new FileReader();
        reader.onload = e => {
            setupControls(N);
            dataStore = parseTouchstone(e.target.result, N);
            updatePlots();
            plotsDiv.style.display = 'block';
        };
        reader.readAsText(file);
    });
    
    // --- UI 컨트롤 생성 ---
    function setupControls(N) {
        paramCheckboxes.innerHTML = '';
        Sparams = [];
        for (let i = 1; i <= N; i++) {
            for (let j = 1; j <= N; j++) {
                const name = `S${i}${j}`;
                Sparams.push(name);
                
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = 'chk' + name;
                checkbox.checked = (i === j || (i === 2 && j === 1)); // S11, S21 등 기본값
                checkbox.addEventListener('change', updatePlots);

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(name));
                paramCheckboxes.appendChild(label);
            }
        }
        controlsDiv.style.display = 'block';
    }

    // --- Touchstone 파서 ---
    function parseTouchstone(text, N) {
        const lines = text.split(/\r?\n/);
        let format = null;
        const freq = [], mags = {}, phs = {};
        Sparams.forEach(p => { mags[p] = []; phs[p] = []; });

        for (let ln of lines) {
            ln = ln.trim();
            if (!ln || ln.startsWith('!')) continue;
            if (ln.startsWith('#')) {
                const parts = ln.split(/\s+/);
                format = parts[3]?.toUpperCase();
                continue;
            }
            
            const vals = ln.split(/\s+/).map(Number);
            if (!format || vals.length < 1 + 2 * N * N) continue;

            freq.push(vals[0]);
            
            for (let idx = 0; idx < N * N; idx++) {
                const a = vals[1 + 2 * idx];
                const b = vals[1 + 2 * idx + 1];
                let mag = 0, ph = 0;
                
                if (format === 'RI') {
                    mag = Math.hypot(a, b);
                    ph = Math.atan2(b, a) * 180 / Math.PI;
                } else if (format === 'MA') {
                    mag = a;
                    ph = b;
                } else if (format === 'DB') {
                    mag = Math.pow(10, a / 20);
                    ph = b;
                }

                const key = Sparams[idx];
                mags[key].push(20 * Math.log10(mag)); // dB로 통일
                phs[key].push(ph);
            }
        }
        return { freq, mags, phs };
    }

    // --- 플롯 업데이트 ---
    function updatePlots() {
        if (!dataStore) return;

        const { freq, mags, phs } = dataStore;
        const magTraces = [], phTraces = [];
        let overallMin = 0;

        Sparams.forEach(name => {
            const checkbox = document.getElementById('chk' + name);
            if (checkbox && checkbox.checked) {
                const yMag = mags[name];
                const curMin = Math.min(...yMag.filter(v => isFinite(v)));
                if (curMin < overallMin) overallMin = curMin;

                magTraces.push({ x: freq, y: yMag, name: `${name} (dB)`, mode: 'lines' });
                phTraces.push({ x: freq, y: phs[name], name: `∠${name} (°)`, mode: 'lines' });
            }
        });
        
        const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
        const layoutOptions = {
            paper_bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
            plot_bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
            font: { color: isDarkMode ? '#f1f5f9' : '#0f172a' },
            xaxis: { title: 'Frequency (GHz)', gridcolor: isDarkMode ? '#475569' : '#e2e8f0' },
            yaxis: { gridcolor: isDarkMode ? '#475569' : '#e2e8f0' }
        };

        const magLayout = {
            ...layoutOptions,
            title: 'Magnitude (dB)',
            yaxis: { ...layoutOptions.yaxis, title: '|S| (dB)', autorange: 'reversed' }
        };
        const phLayout = {
            ...layoutOptions,
            title: 'Phase (°)',
            yaxis: { ...layoutOptions.yaxis, title: '∠S (°)' }
        };

        Plotly.react('magPlot', magTraces, magLayout);
        Plotly.react('phasePlot', phTraces, phLayout);
    }
});
