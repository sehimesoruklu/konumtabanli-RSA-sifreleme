import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  generateRSAFromCoordinates,
  rsaEncrypt,
  rsaDecrypt,
  type RSAKeyParams,
} from "@/lib/geoRsa";
import {
  MapPin,
  Lock,
  Unlock,
  Key,
  Clock,
  Copy,
  Trash2,
  ChevronRight,
  Shield,
  Cpu,
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

// ─── Tip tanımları ───────────────────────────────────────────────────────────
interface HistoryEntry {
  id: number;
  latitude: number;
  longitude: number;
  label: string | null;
  nModulusSummary: string | null;
  bitLength: number | null;
  publicExponent: string | null;
  createdAt: Date;
}

type ActiveTab = "encrypt" | "decrypt" | "keys";

// ─── Yardımcı bileşenler ─────────────────────────────────────────────────────
function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
      title={`${label ?? "Kopyala"}`}
    >
      {copied ? <CheckCircle2 size={12} className="text-accent" /> : <Copy size={12} />}
      {copied ? "Kopyalandı" : (label ?? "Kopyala")}
    </button>
  );
}

function ParamRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <CopyButton value={value} />
      </div>
      <p className={`text-xs break-all leading-relaxed text-foreground/80 ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────
export default function Home() {
  // Konum state
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [locationLabel, setLocationLabel] = useState("");

  // RSA state
  const [rsaParams, setRsaParams] = useState<RSAKeyParams | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Şifreleme/Çözme state
  const [plaintext, setPlaintext] = useState("");
  const [ciphertext, setCiphertext] = useState("");
  const [decryptInput, setDecryptInput] = useState("");
  const [decryptedText, setDecryptedText] = useState("");
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [encryptError, setEncryptError] = useState("");
  const [decryptError, setDecryptError] = useState("");

  // UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>("encrypt");
  const [searchQuery, setSearchQuery] = useState("");

  // Harita ref
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // tRPC
  const saveLocationMutation = trpc.geo.saveLocation.useMutation();
  const deleteLocationMutation = trpc.geo.deleteLocation.useMutation();
  const historyQuery = trpc.geo.getHistory.useQuery();
  const utils = trpc.useUtils();

  // ─── Konum seçildiğinde RSA üret ─────────────────────────────────────────
  const handleLocationSelect = useCallback(async (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setLatInput(newLat.toFixed(6));
    setLngInput(newLng.toFixed(6));
    setRsaParams(null);
    setCiphertext("");
    setDecryptedText("");
    setEncryptError("");
    setDecryptError("");

    setIsGenerating(true);
    try {
      // Web Worker yerine setTimeout ile UI'nin donmaması için
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const params = generateRSAFromCoordinates(newLat, newLng, 512);
          setRsaParams(params);
          resolve();
        }, 10);
      });
    } catch (err) {
      toast.error("Anahtar üretimi başarısız");
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // ─── Harita hazır olduğunda ───────────────────────────────────────────────
  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    geocoderRef.current = new google.maps.Geocoder();

    // Harita tıklama olayı
    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const newLat = parseFloat(e.latLng.lat().toFixed(6));
      const newLng = parseFloat(e.latLng.lng().toFixed(6));

      // Marker güncelle
      if (markerRef.current) markerRef.current.map = null;
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: newLat, lng: newLng },
        title: `(${newLat}, ${newLng})`,
      });

      handleLocationSelect(newLat, newLng);
    });
  }, [handleLocationSelect]);

  // ─── Manuel koordinat girişi ──────────────────────────────────────────────
  const handleManualCoord = () => {
    const newLat = parseFloat(latInput);
    const newLng = parseFloat(lngInput);
    if (isNaN(newLat) || isNaN(newLng) || newLat < -90 || newLat > 90 || newLng < -180 || newLng > 180) {
      toast.error("Geçersiz koordinat değerleri");
      return;
    }
    if (mapRef.current) {
      mapRef.current.setCenter({ lat: newLat, lng: newLng });
      mapRef.current.setZoom(12);
      if (markerRef.current) markerRef.current.map = null;
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: newLat, lng: newLng },
      });
    }
    handleLocationSelect(newLat, newLng);
  };

  // ─── Arama ───────────────────────────────────────────────────────────────
  const handleSearch = () => {
    if (!searchQuery.trim() || !geocoderRef.current || !mapRef.current) return;
    geocoderRef.current.geocode({ address: searchQuery }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const loc = results[0].geometry.location;
        const newLat = parseFloat(loc.lat().toFixed(6));
        const newLng = parseFloat(loc.lng().toFixed(6));
        mapRef.current!.setCenter({ lat: newLat, lng: newLng });
        mapRef.current!.setZoom(14);
        if (markerRef.current) markerRef.current.map = null;
        markerRef.current = new google.maps.marker.AdvancedMarkerElement({
          map: mapRef.current!,
          position: { lat: newLat, lng: newLng },
        });
        handleLocationSelect(newLat, newLng);
        setSearchQuery("");
      } else {
        toast.error("Konum bulunamadı");
      }
    });
  };

  // ─── Şifreleme ────────────────────────────────────────────────────────────
  const handleEncrypt = async () => {
    if (!rsaParams || !plaintext.trim()) return;
    setIsEncrypting(true);
    setEncryptError("");
    try {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = rsaEncrypt(plaintext, rsaParams.e, rsaParams.n);
          setCiphertext(result);
          resolve();
        }, 10);
      });
    } catch (err) {
      setEncryptError("Şifreleme hatası: " + String(err));
    } finally {
      setIsEncrypting(false);
    }
  };

  // ─── Şifre Çözme ─────────────────────────────────────────────────────────
  const handleDecrypt = async () => {
    if (!rsaParams || !decryptInput.trim()) return;
    setIsDecrypting(true);
    setDecryptError("");
    try {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = rsaDecrypt(decryptInput, rsaParams.d, rsaParams.n);
          setDecryptedText(result);
          resolve();
        }, 10);
      });
    } catch (err) {
      setDecryptError("Şifre çözme hatası. Koordinatlar eşleşmiyor olabilir.");
    } finally {
      setIsDecrypting(false);
    }
  };

  // ─── Geçmişe kaydet ──────────────────────────────────────────────────────
  const handleSaveToHistory = async () => {
    if (!rsaParams) return;
    await saveLocationMutation.mutateAsync({
      latitude: rsaParams.latitude,
      longitude: rsaParams.longitude,
      label: locationLabel || undefined,
      nModulusSummary: rsaParams.nSummary,
      bitLength: rsaParams.bitLength,
    });
    utils.geo.getHistory.invalidate();
    toast.success("Konum geçmişe kaydedildi");
    setLocationLabel("");
  };

  // ─── Geçmişten seç ───────────────────────────────────────────────────────
  const handleSelectFromHistory = (entry: HistoryEntry) => {
    if (mapRef.current) {
      mapRef.current.setCenter({ lat: entry.latitude, lng: entry.longitude });
      mapRef.current.setZoom(12);
      if (markerRef.current) markerRef.current.map = null;
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: entry.latitude, lng: entry.longitude },
      });
    }
    handleLocationSelect(entry.latitude, entry.longitude);
  };

  // ─── Geçmişten sil ───────────────────────────────────────────────────────
  const handleDeleteFromHistory = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteLocationMutation.mutateAsync({ id });
    utils.geo.getHistory.invalidate();
    toast.success("Konum silindi");
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Shield size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight gradient-text">GeoEncryption RSA</h1>
              <p className="text-xs text-muted-foreground">Konum Tabanlı Şifreleme Sistemi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lat !== null && lng !== null && (
              <Badge variant="outline" className="text-xs border-accent/40 text-accent font-mono">
                <MapPin size={10} className="mr-1" />
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </Badge>
            )}
            {rsaParams && (
              <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                <Key size={10} className="mr-1" />
                {rsaParams.bitLength}-bit RSA
              </Badge>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* ─── Sol Panel: Harita + Kontroller ─────────────────────────────── */}
        <div className="w-full lg:w-[55%] flex flex-col border-r border-border/50 lg:border-r">
          {/* Arama ve Manuel Giriş */}
          <div className="p-4 border-b border-border/50 bg-card/30 space-y-3">
            {/* Arama */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Konum ara (şehir, adres...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-8 h-9 bg-input/50 border-border/50 text-sm"
                />
              </div>
              <Button onClick={handleSearch} size="sm" variant="outline" className="border-border/50 h-9">
                Ara
              </Button>
            </div>

            {/* Manuel Koordinat */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Enlem (lat)"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  className="h-8 text-xs font-mono bg-input/50 border-border/50"
                />
                <Input
                  placeholder="Boylam (lng)"
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualCoord()}
                  className="h-8 text-xs font-mono bg-input/50 border-border/50"
                />
              </div>
              <Button onClick={handleManualCoord} size="sm" variant="outline" className="h-8 border-border/50 text-xs">
                <MapPin size={12} className="mr-1" />
                Uygula
              </Button>
            </div>
          </div>

          {/* Harita */}
          <div className="flex-1 relative">
            <MapView
              className="w-full h-[300px] lg:h-full"
              initialCenter={{ lat: 39.9334, lng: 32.8597 }}
              initialZoom={6}
              onMapReady={handleMapReady}
            />
            {/* Harita overlay hint */}
            {lat === null && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-card/90 backdrop-blur-sm border border-border/50 rounded-xl px-5 py-3 text-center shadow-xl">
                  <MapPin size={20} className="text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">Haritaya tıklayarak konum seçin</p>
                  <p className="text-xs text-muted-foreground mt-1">veya yukarıdan arama yapın</p>
                </div>
              </div>
            )}
          </div>

          {/* Konum Geçmişi */}
          <div className="border-t border-border/50 bg-card/20">
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Konum Geçmişi</span>
              </div>
              {rsaParams && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Etiket (opsiyonel)"
                    value={locationLabel}
                    onChange={(e) => setLocationLabel(e.target.value)}
                    className="h-6 text-xs w-36 bg-input/50 border-border/50"
                  />
                  <Button
                    onClick={handleSaveToHistory}
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs border-primary/40 text-primary hover:bg-primary/10"
                    disabled={saveLocationMutation.isPending}
                  >
                    Kaydet
                  </Button>
                </div>
              )}
            </div>
            <div className="max-h-32 overflow-y-auto px-3 pb-2 space-y-1">
              {historyQuery.data && historyQuery.data.length > 0 ? (
                historyQuery.data.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => handleSelectFromHistory(entry as HistoryEntry)}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-card/50 hover:bg-card border border-border/30 hover:border-primary/30 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin size={11} className="text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {entry.label ?? `Konum (${entry.latitude.toFixed(4)}, ${entry.longitude.toFixed(4)})`}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {entry.latitude.toFixed(6)}, {entry.longitude.toFixed(6)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {entry.bitLength && (
                        <Badge variant="outline" className="text-xs border-border/40 text-muted-foreground h-4 px-1.5">
                          {entry.bitLength}b
                        </Badge>
                      )}
                      <button
                        onClick={(e) => handleDeleteFromHistory(entry.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-all"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Henüz kayıtlı konum yok
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ─── Sağ Panel: RSA İşlemleri ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Anahtar Üretim Durumu */}
          <div className="p-4 border-b border-border/50 bg-card/20">
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div
                  key="generating"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center animate-pulse-glow">
                    <Cpu size={15} className="text-primary animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">RSA Anahtar Üretiliyor...</p>
                    <p className="text-xs text-muted-foreground">Miller-Rabin testi çalışıyor</p>
                  </div>
                </motion.div>
              ) : rsaParams ? (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
                      <Key size={15} className="text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {rsaParams.bitLength}-bit RSA Anahtarı Hazır
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        e = {rsaParams.e} · p({rsaParams.pBits}b) · q({rsaParams.qBits}b)
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-accent/10 text-accent border-accent/30 text-xs">
                    <CheckCircle2 size={10} className="mr-1" />
                    Deterministik
                  </Badge>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center">
                    <Key size={15} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Konum Seçilmedi</p>
                    <p className="text-xs text-muted-foreground">Haritadan bir konum seçin</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tab Navigasyonu */}
          <div className="flex border-b border-border/50">
            {(["encrypt", "decrypt", "keys"] as ActiveTab[]).map((tab) => {
              const icons = { encrypt: Lock, decrypt: Unlock, keys: Key };
              const labels = { encrypt: "Şifrele", decrypt: "Çöz", keys: "Parametreler" };
              const Icon = icons[tab];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all border-b-2 ${
                    activeTab === tab
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/30"
                  }`}
                >
                  <Icon size={13} />
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* Tab İçerikleri */}
          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              {/* ─── Şifreleme Tab ─────────────────────────────────────── */}
              {activeTab === "encrypt" && (
                <motion.div
                  key="encrypt"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      Şifrelenecek Metin
                    </label>
                    <Textarea
                      placeholder="Şifrelemek istediğiniz metni girin..."
                      value={plaintext}
                      onChange={(e) => setPlaintext(e.target.value)}
                      className="min-h-[100px] bg-input/50 border-border/50 text-sm resize-none font-mono"
                      disabled={!rsaParams}
                    />
                  </div>

                  <Button
                    onClick={handleEncrypt}
                    disabled={!rsaParams || !plaintext.trim() || isEncrypting}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    {isEncrypting ? (
                      <><Loader2 size={14} className="mr-2 animate-spin" />Şifreleniyor...</>
                    ) : (
                      <><Lock size={14} className="mr-2" />RSA Public Key ile Şifrele</>
                    )}
                  </Button>

                  {encryptError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                      <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
                      <p className="text-xs text-destructive">{encryptError}</p>
                    </div>
                  )}

                  {ciphertext && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Şifreli Çıktı (Ciphertext)
                        </label>
                        <CopyButton value={ciphertext} label="Kopyala" />
                      </div>
                      <div className="p-3 rounded-lg bg-card border border-border/50 glow-gold">
                        <p className="text-xs font-mono break-all text-primary/80 leading-relaxed max-h-32 overflow-y-auto">
                          {ciphertext}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 size={11} className="text-accent" />
                        <span>Public key (e={rsaParams?.e}) ile şifrelendi</span>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ─── Şifre Çözme Tab ───────────────────────────────────── */}
              {activeTab === "decrypt" && (
                <motion.div
                  key="decrypt"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Şifreli Metin (Ciphertext)
                      </label>
                      {ciphertext && (
                        <button
                          onClick={() => setDecryptInput(ciphertext)}
                          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw size={10} />
                          Şifreleme çıktısını kullan
                        </button>
                      )}
                    </div>
                    <Textarea
                      placeholder="Çözülecek şifreli metni girin (hex formatı)..."
                      value={decryptInput}
                      onChange={(e) => setDecryptInput(e.target.value)}
                      className="min-h-[100px] bg-input/50 border-border/50 text-xs font-mono resize-none"
                      disabled={!rsaParams}
                    />
                  </div>

                  <Button
                    onClick={handleDecrypt}
                    disabled={!rsaParams || !decryptInput.trim() || isDecrypting}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
                  >
                    {isDecrypting ? (
                      <><Loader2 size={14} className="mr-2 animate-spin" />Çözülüyor...</>
                    ) : (
                      <><Unlock size={14} className="mr-2" />RSA Private Key ile Çöz</>
                    )}
                  </Button>

                  {decryptError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                      <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
                      <p className="text-xs text-destructive">{decryptError}</p>
                    </div>
                  )}

                  {decryptedText && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Çözülen Metin (Plaintext)
                        </label>
                        <CopyButton value={decryptedText} label="Kopyala" />
                      </div>
                      <div className="p-3 rounded-lg bg-card border border-border/50 glow-green">
                        <p className="text-sm text-foreground leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {decryptedText}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 size={11} className="text-accent" />
                        <span>Private key (d) ile başarıyla çözüldü</span>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ─── RSA Parametreleri Tab ─────────────────────────────── */}
              {activeTab === "keys" && (
                <motion.div
                  key="keys"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  {rsaParams ? (
                    <>
                      {/* Koordinat Bilgisi */}
                      <div className="p-3 rounded-lg bg-card border border-border/50">
                        <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                          <MapPin size={12} />
                          Konum Bilgisi
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Enlem (Latitude)</p>
                            <p className="text-sm font-mono text-foreground">{rsaParams.latitude.toFixed(6)}°</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Boylam (Longitude)</p>
                            <p className="text-sm font-mono text-foreground">{rsaParams.longitude.toFixed(6)}°</p>
                          </div>
                        </div>
                      </div>

                      {/* Çekirdek Sayılar */}
                      <div className="p-3 rounded-lg bg-card border border-border/50">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Cpu size={12} />
                          Çekirdek Sayılar (Seed)
                        </h3>
                        <ParamRow label="Np Çekirdeği (seedP)" value={rsaParams.seedP} />
                        <ParamRow label="Nq Çekirdeği (seedQ)" value={rsaParams.seedQ} />
                      </div>

                      {/* Asal Sayılar */}
                      <div className="p-3 rounded-lg bg-card border border-border/50">
                        <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Shield size={12} />
                          Asal Sayılar
                        </h3>
                        <div className="flex gap-2 mb-3">
                          <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                            p: {rsaParams.pBits}-bit
                          </Badge>
                          <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                            q: {rsaParams.qBits}-bit
                          </Badge>
                        </div>
                        <ParamRow label="p (asal sayı)" value={rsaParams.pSummary} />
                        <ParamRow label="q (asal sayı)" value={rsaParams.qSummary} />
                      </div>

                      {/* RSA Parametreleri */}
                      <div className="p-3 rounded-lg bg-card border border-border/50">
                        <h3 className="text-xs font-bold text-accent uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Key size={12} />
                          RSA Parametreleri
                        </h3>
                        <div className="flex gap-2 mb-3">
                          <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">
                            n = p × q
                          </Badge>
                          <Badge className="bg-accent/10 text-accent border-accent/30 text-xs">
                            {rsaParams.bitLength}-bit
                          </Badge>
                        </div>
                        <ParamRow label="n (modül)" value={rsaParams.nSummary} />
                        <ParamRow label="e (public exponent)" value={rsaParams.e} />
                        <ParamRow label="d (private exponent)" value={rsaParams.dSummary} />
                      </div>

                      {/* Formüller */}
                      <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                          RSA Formülleri
                        </h3>
                        <div className="space-y-2">
                          {[
                            { label: "Modül", formula: "n = p × q" },
                            { label: "Euler Totient", formula: "φ(n) = (p−1)(q−1)" },
                            { label: "Şifreleme", formula: "C ≡ Mᵉ (mod n)" },
                            { label: "Çözme", formula: "M ≡ Cᵈ (mod n)" },
                            { label: "Miller-Rabin", formula: "n−1 = 2ʳ × d" },
                          ].map(({ label, formula }) => (
                            <div key={label} className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">{label}</span>
                              <code className="text-xs font-mono text-primary/80 bg-primary/5 px-2 py-0.5 rounded">
                                {formula}
                              </code>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center mb-4">
                        <Key size={24} className="text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground">Anahtar Yok</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Haritadan bir konum seçerek RSA anahtar çifti üretin
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
