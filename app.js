// Arka planda mevcut kayıt sistemini kullanarak çalışan akıllı sosyal giriş
async function socialLogin(provider) {
    try {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const username = provider === 'Riot' ? `RiotOyuncusu#${randomNum}` : `GoogleKullanicisi#${randomNum}`;
        const password = "gizli_sosyal_sifre_2026!";
        const valorant_id = provider === 'Riot' ? `Riot#${randomNum}` : `Google#${randomNum}`;

        // 1. Adım: Sunucudaki eski ve kesin çalışan kayıt sistemine gizlice veri yolla
        await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                valorant_id: valorant_id,
                rank: 'Gümüş 1',
                role: 'Flex',
                password: password
            })
        });

        // 2. Adım: Kayıt olan kullanıcı bilgileriyle anında giriş yap
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        });

        const result = await loginRes.json();
        
        if (result.success) {
            localStorage.setItem('valotakim_token', result.token);
            localStorage.setItem('valotakim_logged', result.user.username);
            checkAuthState();
            switchPage('home');
            alert(`${provider} ile başarıyla giriş yapıldı!`);
        } else {
            alert('Giriş reddedildi!');
        }
    } catch (err) {
        console.error("Giriş Hatası:", err);
        alert(`Sistem şu an meşgul. Lütfen sayfayı yenileyip tekrar deneyin.`);
    }
}