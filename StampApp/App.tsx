import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, View, Text, SafeAreaView, ScrollView, 
  TouchableOpacity, Dimensions, StatusBar, Image, TextInput, Alert, Modal, Animated, Vibration 
} from 'react-native';
import QRCode from 'react-native-qrcode-svg'; 
import { 
  ScanLine, ArrowLeft, Sparkles, X, Trash2, Edit3, Plus, Ticket, 
  CheckCircle2, QrCode, MapPin, Award, ChevronRight,
  Clock, AlignLeft, RefreshCw, Layers
} from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width, height } = Dimensions.get('window');

// --- 硬件物理参数配置 ---
const STAMP_CONFIG = {
  SIDE_LENGTH: 250,        // 正方形边长
  DIAGONAL: 250 * Math.sqrt(2), // 对角线长度 ≈ 353.5px
  TOLERANCE: 45,           // 容差，应对硅胶头按压形变
  SUCCESS_THRESHOLD: 100,  
};

const COLORS = { 
  blue: '#A2D5EA', yellow: '#F4CC60', brown: '#7C6154', 
  dark: '#381D0E', bg: '#FDFBF7', white: '#FFFFFF',
  red: '#FF6B6B', green: '#88B04B', gray: '#A0A0A0',
  lightGray: '#F0F0F0', overlay: 'rgba(0,0,0,0.9)'
};

const STAMP_IMAGES: { [key: string]: any } = {
  '01': require('./assets/images/01.png'),
  '02': require('./assets/images/02.png'),
  '03': require('./assets/images/03.png'),
  '04': require('./assets/images/04.png'),
  '05': require('./assets/images/05.png'),
  '06': require('./assets/images/06.png'),
  '07': require('./assets/images/07.png'),
};

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [role, setRole] = useState<'user' | 'admin'>('user');
  
  // --- 初始状态：确保没有任何已解锁的活动 ---
  const [unlockedEventIds, setUnlockedEventIds] = useState<string[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);

  // --- 核心防卡死锁 (CRITICAL FIX FOR CRASHING) ---
  const isProcessingScan = useRef(false);

  // --- 商家预设数据 ---
  const [merchantEvents, setMerchantEvents] = useState([
    {
      id: 'HKU_IDAT_7213',
      title: "Mind-Mahjong Demo",
      location: "Knowles Building, HKU",
      date: "2026.05.20",
      description: "A somatosensory rehabilitation system for cognitive health.",
      coverColor: COLORS.blue,
      stamps: [
        { id: 's1', name: "Hardware Intro", collected: false, imgKey: '01' },
        { id: 's2', name: "Cognitive Test", collected: false, imgKey: '02' }
      ]
    },
    {
      id: 'SILK_ROAD_VR',
      title: "Silk Road Explorer",
      location: "Digital Media Lab",
      date: "2026.07.01",
      description: "VR project featuring Chang'an and Dunhuang murals.",
      coverColor: COLORS.yellow,
      stamps: [
        { id: 'sr1', name: "Chang'an Market", collected: false, imgKey: '05' }
      ]
    }
  ]);

  // --- 弹窗控制 ---
  const [showScanner, setShowScanner] = useState(false);
  const [stampPadData, setStampPadData] = useState<any>(null); 
  const [lastStampedImg, setLastStampedImg] = useState<any>(null); 
  const [showUnlockSuccess, setShowUnlockSuccess] = useState<string | null>(null); 

  useEffect(() => {
    (async () => { if (!permission?.granted) await requestPermission(); })();
    setTimeout(() => setIsAppLoading(false), 1500);
  }, []);

  // --- 扫码核心逻辑（防抖防卡死版） ---
  const handleBarCodeScanned = ({ data }: any) => {
    // 1. 如果正在处理中，或者扫码器已关闭，直接拦截
    if (isProcessingScan.current || !showScanner) return;

    // 2. 立即上锁，防止重复触发回调
    isProcessingScan.current = true;

    const matched = merchantEvents.find(e => e.id === data);
    
    if (matched) {
      Vibration.vibrate(100);
      if (!unlockedEventIds.includes(data)) {
        // 新活动解锁
        setUnlockedEventIds(prev => [...prev, data]);
        setShowScanner(false);
        // 延迟解锁成功提示，确保扫码 Modal 已经完全卸载
        setTimeout(() => {
          setShowUnlockSuccess(matched.title);
          isProcessingScan.current = false; // 解锁物理锁
        }, 600);
      } else {
        // 已解锁过
        Alert.alert(
          "Already Unlocked", 
          "You already have this event journal in your collection.",
          [{ 
            text: "OK", 
            onPress: () => {
              setShowScanner(false);
              // 关键：点击 OK 后延迟释放锁，避免瞬间再次触发扫描
              setTimeout(() => { isProcessingScan.current = false; }, 800);
            } 
          }]
        );
      }
    } else {
      // 扫到无效码
      isProcessingScan.current = false; 
    }
  };

  // --- 商家管理逻辑 ---
  const adminAddEvent = () => {
    const newId = `EVT_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const newEvent = {
      id: newId, title: "New Heritage Trail", location: "HKU Campus", date: "2026.09.01",
      description: "Enter description here.", coverColor: COLORS.yellow,
      stamps: [{ id: `s_${Date.now()}`, name: "Checkpoint 1", collected: false, imgKey: '01' }]
    };
    setMerchantEvents([newEvent, ...merchantEvents]);
  };

  const adminUpdateField = (id: string, field: string, value: any) => {
    setMerchantEvents(prev => prev.map(ev => ev.id === id ? { ...ev, [field]: value } : ev));
  };

  const adminDeleteEvent = (id: string) => {
    Alert.alert("Delete Event?", "All visitor progress will be lost.", [
      { text: "Cancel" }, { text: "Delete", onPress: () => setMerchantEvents(prev => prev.filter(e => e.id !== id)), style: 'destructive' }
    ]);
  };

  const adminAddStamp = (eventId: string) => {
    setMerchantEvents(prev => prev.map(ev => {
      if (ev.id === eventId) {
        return { ...ev, stamps: [...ev.stamps, { id: `s_${Date.now()}`, name: "New Point", collected: false, imgKey: '01' }] };
      }
      return ev;
    }));
  };

  const adminEditStamp = (eventId: string, stampId: string, updates: any) => {
    setMerchantEvents(prev => prev.map(ev => {
      if (ev.id === eventId) {
        return { ...ev, stamps: ev.stamps.map(s => s.id === stampId ? { ...s, ...updates } : s) };
      }
      return ev;
    }));
  };

  const currentUserEvents = merchantEvents.filter(ev => unlockedEventIds.includes(ev.id));
  const activeEvent = merchantEvents.find(e => e.id === activeEventId);

  if (isAppLoading) return (
    <View style={styles.loading}>
      <Image source={require('./assets/images/01.png')} style={{width: 80, height: 80, marginBottom: 20}} />
      <Text style={styles.loadingText}>StampLog</Text>
    </View>
  );

  return (
    <View style={styles.mainContainer}>
      <SafeAreaView style={{flex: 1}}>
        <StatusBar barStyle="dark-content" />
        
        {/* 角色切换器 */}
        <View style={styles.navHeader}>
          <View style={styles.toggleTrack}>
            <TouchableOpacity onPress={() => setRole('user')} style={[styles.toggleBtn, role === 'user' && styles.toggleActive]}>
              <Text style={[styles.toggleText, role === 'user' && styles.toggleTextActive]}>Explorer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRole('admin')} style={[styles.toggleBtn, role === 'admin' && styles.toggleActive]}>
              <Text style={[styles.toggleText, role === 'admin' && styles.toggleTextActive]}>Merchant</Text>
            </TouchableOpacity>
          </View>
        </View>

        {role === 'user' ? (
          <View style={{flex: 1}}>
            {lastStampedImg ? (
              <SuccessModal img={lastStampedImg} onDone={() => setLastStampedImg(null)} />
            ) : stampPadData ? (
              <GeometricStampScreen 
                data={stampPadData} 
                onCancel={() => setStampPadData(null)} 
                onSuccess={() => {
                  setMerchantEvents(prev => prev.map(ev => ({
                    ...ev, stamps: ev.stamps.map(s => s.id === stampPadData.id ? {...s, collected: true} : s)
                  })));
                  setLastStampedImg(STAMP_IMAGES[stampPadData.imgKey]);
                  setStampPadData(null);
                  Vibration.vibrate([0, 100, 50, 100]);
                }}
              />
            ) : activeEvent ? (
              /* 活动详情页 */
              <View style={{flex: 1}}>
                <View style={[styles.detailHero, {backgroundColor: activeEvent.coverColor}]}>
                  <TouchableOpacity onPress={() => setActiveEventId(null)} style={styles.backBtn}><ArrowLeft color={COLORS.dark}/></TouchableOpacity>
                  <Text style={styles.detailTitle}>{activeEvent.title}</Text>
                  <View style={styles.detailMeta}>
                    <View style={styles.pill}><Award size={14} color="white"/><Text style={styles.pillText}>{activeEvent.stamps.filter(s=>s.collected).length}/{activeEvent.stamps.length}</Text></View>
                    <View style={styles.pillLight}><MapPin size={12} color={COLORS.dark}/><Text style={styles.pillTextDark}>{activeEvent.location}</Text></View>
                  </View>
                </View>
                <ScrollView contentContainerStyle={styles.detailScrollBody}>
                  <View style={styles.infoRow}><Clock size={14} color={COLORS.brown}/><Text style={styles.infoText}>{activeEvent.date}</Text></View>
                  <Text style={styles.detailDesc}>{activeEvent.description}</Text>
                  <View style={styles.stampGrid}>
                    {activeEvent.stamps.map((s, idx) => (
                      <TouchableOpacity key={s.id} onPress={() => !s.collected && setStampPadData(s)} style={[styles.stampTile, s.collected ? styles.tileCollected : styles.tileLocked]}>
                        <Text style={styles.tileIdx}>{String(idx+1).padStart(2, '0')}</Text>
                        {s.collected ? <Image source={STAMP_IMAGES[s.imgKey]} style={styles.tileImg} /> : <Text style={styles.tileLockIcon}>?</Text>}
                        <Text style={styles.tileName}>{s.name}</Text>
                        {s.collected && <View style={styles.checkBadge}><CheckCircle2 size={16} color="white" fill={COLORS.green}/></View>}
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : (
              /* 用户主页 */
              <View style={{flex: 1, paddingHorizontal: 24}}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.brandTitle}>StampLog</Text>
                  <Text style={styles.brandSub}>Track your physical journey.</Text>
                  
                  {currentUserEvents.length === 0 ? (
                    <View style={styles.emptyState}>
                      <View style={styles.emptyCircle}><Layers color={COLORS.gray} size={40}/></View>
                      <Text style={styles.emptyText}>Scan an Event QR code at the entrance to begin your collection.</Text>
                    </View>
                  ) : (
                    currentUserEvents.map(ev => (
                      <TouchableOpacity key={ev.id} onPress={() => setActiveEventId(ev.id)} style={[styles.eventCard, {backgroundColor: ev.coverColor}]}>
                        <Text style={styles.eventCardTitle}>{ev.title}</Text>
                        <View style={styles.eventCardFooter}>
                          <View style={styles.stack}>
                            {ev.stamps.map((s, idx) => (
                              <View key={s.id} style={[styles.stackCircle, {marginLeft: idx===0?0:-15}, s.collected?styles.stackActive:styles.stackLocked]}>
                                {s.collected && <Image source={STAMP_IMAGES[s.imgKey]} style={{width: 22, height: 22}} />}
                              </View>
                            ))}
                          </View>
                          <View style={styles.cardAction}><Text style={styles.cardActionText}>Details</Text><ChevronRight color="white" size={14}/></View>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                  <View style={{height: 120}} />
                </ScrollView>
                <TouchableOpacity style={styles.fab} onPress={() => { isProcessingScan.current = false; setShowScanner(true); }}>
                  <ScanLine color={COLORS.dark} size={32}/>
                  <Text style={styles.fabText}>SCAN ENTRANCE</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          /* 商家端管理界面 */
          <ScrollView style={styles.adminScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.adminHeader}>
              <Text style={styles.adminTitle}>Merchant Console</Text>
              <TouchableOpacity style={styles.adminAdd} onPress={adminAddEvent}><Plus color="white" size={24}/></TouchableOpacity>
            </View>

            {merchantEvents.map(ev => (
              <View key={ev.id} style={styles.adminCard}>
                <View style={styles.adminCardTop}>
                  <TextInput style={styles.adminInputTitle} value={ev.title} onChangeText={v => adminUpdateField(ev.id, 'title', v)} />
                  <TouchableOpacity onPress={() => adminDeleteEvent(ev.id)}><Trash2 size={20} color={COLORS.red}/></TouchableOpacity>
                </View>
                <TextInput style={styles.adminInputSub} value={ev.location} onChangeText={v => adminUpdateField(ev.id, 'location', v)} placeholder="Location" />
                <TextInput style={styles.adminInputArea} value={ev.description} onChangeText={v => adminUpdateField(ev.id, 'description', v)} multiline placeholder="Description" />
                
                <View style={styles.adminQRBox}>
                  <QRCode value={ev.id} size={140} color={COLORS.dark} />
                  <Text style={styles.adminQRId}>Entrance QR Code (ID: {ev.id})</Text>
                </View>

                <Text style={styles.adminLabel}>Stamp Points ({ev.stamps.length})</Text>
                {ev.stamps.map((s, sIdx) => (
                  <View key={s.id} style={styles.adminStampRow}>
                    <Text style={styles.adminStampIdx}>{sIdx+1}</Text>
                    <TextInput style={styles.adminStampInput} value={s.name} onChangeText={v => adminEditStamp(ev.id, s.id, {name: v})} />
                    <TouchableOpacity style={styles.adminStampIcon} onPress={() => {
                        const next = (parseInt(s.imgKey) % 7 + 1).toString().padStart(2, '0');
                        adminEditStamp(ev.id, s.id, {imgKey: next});
                    }}><Image source={STAMP_IMAGES[s.imgKey]} style={{width: 24, height: 24}}/></TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.adminAddPoint} onPress={() => adminAddStamp(ev.id)}><Plus size={16} color={COLORS.brown}/><Text style={styles.adminAddPointText}>Add Checkpoint</Text></TouchableOpacity>
              </View>
            ))}
            <View style={{height: 100}} />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* 扫码器 Modal */}
      <Modal visible={showScanner} animationType="slide">
        <CameraView 
          style={StyleSheet.absoluteFill} 
          onBarcodeScanned={handleBarCodeScanned} 
          barcodeSettings={{ barcodeTypes: ["qr"] }}
        />
        <View style={styles.scannerUI}>
          <View style={styles.scannerFrame}>
            <View style={[styles.corner, {top:0, left:0, borderRightWidth:0, borderBottomWidth:0}]} />
            <View style={[styles.corner, {top:0, right:0, borderLeftWidth:0, borderBottomWidth:0}]} />
            <View style={[styles.corner, {bottom:0, left:0, borderRightWidth:0, borderTopWidth:0}]} />
            <View style={[styles.corner, {bottom:0, right:0, borderLeftWidth:0, borderTopWidth:0}]} />
          </View>
          <Text style={styles.scannerText}>Align Entrance QR Code</Text>
        </View>
        <TouchableOpacity style={styles.scannerClose} onPress={() => { isProcessingScan.current = false; setShowScanner(false); }}><X color="white" size={32}/></TouchableOpacity>
      </Modal>

      {/* 解锁成功提示 */}
      <Modal visible={!!showUnlockSuccess} transparent animationType="fade">
        <View style={styles.overlay}><View style={styles.popCard}>
          <View style={styles.popIcon}><Ticket color={COLORS.yellow} size={40}/></View>
          <Text style={styles.popTitle}>New Journal Unlocked!</Text>
          <Text style={styles.popDesc}>{showUnlockSuccess}</Text>
          <TouchableOpacity style={styles.popBtn} onPress={() => setShowUnlockSuccess(null)}><Text style={styles.popBtnText}>Start Journey</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </View>
  );
}

// --- 物理印章识别屏幕 ---
function GeometricStampScreen({ data, onCancel, onSuccess }: any) {
  const [touches, setTouches] = useState<{x: number, y: number}[]>([]);
  const [isValid, setIsValid] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<any>(null);

  const validateGeometry = (pts: {x: number, y: number}[]) => {
    if (pts.length !== 4) return false;
    const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
    const cy = pts.reduce((s, p) => s + p.y, 0) / 4;
    const expectedR = STAMP_CONFIG.DIAGONAL / 2;
    
    return pts.every(p => {
      const d = Math.sqrt(Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2));
      return Math.abs(d - expectedR) < STAMP_CONFIG.TOLERANCE;
    });
  };

  const handleTouch = (e: any) => {
    const pts = e.nativeEvent.touches.map((t: any) => ({ x: t.locationX, y: t.locationY }));
    setTouches(pts);
    const valid = validateGeometry(pts);
    setIsValid(valid);

    if (valid) {
      if (!timer.current) {
        timer.current = setInterval(() => {
          setProgress(p => {
            if (p >= 100) { clearInterval(timer.current); onSuccess(); return 100; }
            return p + 5;
          });
        }, 40);
      }
    } else {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      setProgress(0);
    }
  };

  return (
    <View style={styles.padRoot} onStartShouldSetResponder={() => true} onResponderMove={handleTouch} onResponderRelease={() => {setTouches([]); setIsValid(false); setProgress(0); if(timer.current) clearInterval(timer.current);}}>
      <TouchableOpacity style={styles.padBack} onPress={onCancel}><X color="white" size={30}/></TouchableOpacity>
      <View style={styles.padHead}><Text style={styles.padTitle}>Verify Stamp</Text><Text style={styles.padSub}>Apply your physical stamp to the screen.</Text></View>
      <View style={styles.padCenter}>
        <Svg width="300" height="300" style={StyleSheet.absoluteFill}>
          <Circle cx="150" cy="150" r="140" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
          <Circle cx="150" cy="150" r="140" stroke={COLORS.yellow} strokeWidth="10" fill="none" strokeDasharray="880" strokeDashoffset={880-(880*progress)/100} />
        </Svg>
        <Image source={STAMP_IMAGES[data.imgKey]} style={[styles.padPreview, { opacity: isValid ? 1 : 0.2, transform: [{scale: isValid?1.1:1}] }]} />
        {touches.map((t, i) => <View key={i} style={[styles.touchIndicator, { left: t.x-25, top: t.y-25, borderColor: isValid?COLORS.green:COLORS.red }]} />)}
      </View>
      <Text style={[styles.padStatus, {color: isValid?COLORS.yellow:'white'}]}>{isValid ? "RECOGNIZED! HOLDING..." : `SENSORS: ${touches.length}/4`}</Text>
    </View>
  );
}

function SuccessModal({ img, onDone }: any) {
  return (
    <View style={styles.overlay}><View style={styles.victoryCard}>
      <Sparkles color={COLORS.yellow} size={60}/><Text style={styles.victoryTitle}>STAMPED!</Text>
      <View style={styles.victoryImgWrap}><Image source={img} style={{width: 120, height: 120}}/></View>
      <Text style={styles.victoryDesc}>Your physical action has been recorded in the digital journal.</Text>
      <TouchableOpacity style={styles.victoryBtn} onPress={onDone}><Text style={styles.victoryBtnText}>CONTINUE</Text></TouchableOpacity>
    </View></View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: COLORS.bg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  loadingText: { fontSize: 32, fontWeight: '900', color: COLORS.dark },
  navHeader: { padding: 15, alignItems: 'center' },
  toggleTrack: { flexDirection: 'row', backgroundColor: '#EEE', borderRadius: 25, padding: 4 },
  toggleBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  toggleActive: { backgroundColor: COLORS.dark },
  toggleText: { fontSize: 12, fontWeight: '900', color: '#AAA' },
  toggleTextActive: { color: COLORS.yellow },
  brandTitle: { fontSize: 50, fontWeight: '900', color: COLORS.dark, letterSpacing: -2, marginTop: 20 },
  brandSub: { fontSize: 16, color: COLORS.brown, fontWeight: 'bold', marginBottom: 30 },
  emptyState: { paddingVertical: 80, alignItems: 'center', backgroundColor: 'white', borderRadius: 40, borderStyle: 'dashed', borderWidth: 2, borderColor: '#DDD' },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.lightGray, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyText: { textAlign: 'center', paddingHorizontal: 40, color: COLORS.gray, fontWeight: '700', lineHeight: 22 },
  eventCard: { padding: 25, borderRadius: 38, marginBottom: 20, borderWidth: 2, borderColor: COLORS.dark, shadowColor: "#000", shadowOffset: {width: 6, height: 6}, shadowOpacity: 1 },
  eventCardTitle: { fontSize: 26, fontWeight: '900', color: COLORS.dark, marginBottom: 30 },
  eventCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stack: { flexDirection: 'row' },
  stackCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: COLORS.dark, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
  stackActive: { backgroundColor: 'white' },
  stackLocked: { backgroundColor: 'rgba(0,0,0,0.05)', borderStyle: 'dashed' },
  cardAction: { backgroundColor: COLORS.dark, padding: 10, paddingHorizontal: 15, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  cardActionText: { color: 'white', fontSize: 11, fontWeight: '900', marginRight: 5 },
  fab: { position: 'absolute', bottom: 40, alignSelf: 'center', height: 70, paddingHorizontal: 25, borderRadius: 35, backgroundColor: COLORS.yellow, borderWidth: 4, borderColor: COLORS.dark, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 5}, shadowOpacity: 0.3 },
  fabText: { marginLeft: 10, fontWeight: '900', color: COLORS.dark, fontSize: 14 },
  detailHero: { padding: 30, paddingTop: 50, paddingBottom: 50, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  detailTitle: { fontSize: 34, fontWeight: '900', color: COLORS.dark },
  detailMeta: { flexDirection: 'row', gap: 10, marginTop: 15 },
  pill: { backgroundColor: COLORS.dark, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, flexDirection: 'row', alignItems: 'center' },
  pillLight: { backgroundColor: 'rgba(255,255,255,0.4)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, flexDirection: 'row', alignItems: 'center' },
  pillText: { color: 'white', fontSize: 11, fontWeight: '900', marginLeft: 5 },
  pillTextDark: { color: COLORS.dark, fontSize: 11, fontWeight: '900', marginLeft: 5 },
  detailScrollBody: { padding: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  infoText: { fontSize: 14, fontWeight: '900', color: COLORS.brown, marginLeft: 8 },
  detailDesc: { color: COLORS.dark, fontWeight: '700', lineHeight: 22, opacity: 0.7, marginBottom: 30 },
  stampGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  stampTile: { width: '47%', aspectRatio: 1, borderRadius: 32, padding: 20, marginBottom: 20, alignItems: 'center', justifyContent: 'center' },
  tileLocked: { backgroundColor: 'white', borderStyle: 'dashed', borderWidth: 2, borderColor: '#DDD' },
  tileCollected: { backgroundColor: COLORS.yellow, borderWidth: 3, borderColor: COLORS.dark, shadowColor: COLORS.dark, shadowOffset: {width: 4, height: 4}, shadowOpacity: 1 },
  tileIdx: { position: 'absolute', top: 15, left: 20, fontSize: 18, fontWeight: '900', color: COLORS.dark, opacity: 0.1 },
  tileImg: { width: 80, height: 80 },
  tileLockIcon: { fontSize: 40, color: '#F0F0F0', fontWeight: '900' },
  tileName: { position: 'absolute', bottom: 15, fontSize: 11, fontWeight: '900', color: COLORS.dark },
  checkBadge: { position: 'absolute', top: 15, right: 15 },
  adminScroll: { padding: 24 },
  adminHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  adminTitle: { fontSize: 32, fontWeight: '900' },
  adminAdd: { width: 50, height: 50, borderRadius: 20, backgroundColor: COLORS.dark, justifyContent: 'center', alignItems: 'center' },
  adminCard: { backgroundColor: 'white', borderRadius: 35, padding: 20, marginBottom: 25, borderWidth: 2, borderColor: COLORS.dark, shadowColor: '#EEE', shadowOffset: {width: 0, height: 10}, shadowOpacity: 1 },
  adminCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  adminInputTitle: { fontSize: 20, fontWeight: '900', flex: 1, color: COLORS.dark },
  adminInputSub: { fontSize: 14, color: COLORS.gray, marginBottom: 10, backgroundColor: '#F9F9F9', padding: 10, borderRadius: 12 },
  adminInputArea: { fontSize: 14, backgroundColor: '#F9F9F9', padding: 12, borderRadius: 15, height: 60, color: COLORS.brown },
  adminQRBox: { alignItems: 'center', padding: 25, backgroundColor: '#FAFAFA', borderRadius: 25, marginVertical: 20, borderWeight: 1, borderColor: '#EEE' },
  adminQRId: { fontSize: 10, color: '#AAA', marginTop: 15, fontWeight: 'bold' },
  adminLabel: { fontSize: 14, fontWeight: '900', marginBottom: 15, color: COLORS.dark },
  adminStampRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  adminStampIdx: { width: 24, fontSize: 12, color: '#CCC', fontWeight: '900' },
  adminStampInput: { flex: 1, backgroundColor: '#F9F9F9', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 'bold' },
  adminStampIcon: { padding: 5, backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#EEE' },
  adminAddPoint: { flexDirection: 'row', alignItems: 'center', padding: 15, justifyContent: 'center' },
  adminAddPointText: { color: COLORS.brown, fontSize: 13, fontWeight: '900', marginLeft: 8 },
  padRoot: { flex: 1, backgroundColor: COLORS.dark },
  padBack: { marginTop: 60, marginLeft: 30, padding: 10 },
  padHead: { alignItems: 'center', paddingHorizontal: 50, marginTop: 20 },
  padTitle: { color: COLORS.yellow, fontSize: 32, fontWeight: '900' },
  padSub: { color: 'white', opacity: 0.5, textAlign: 'center', marginTop: 10, fontSize: 14 },
  padCenter: { width: 300, height: 300, alignSelf: 'center', marginTop: 60, justifyContent: 'center', alignItems: 'center' },
  padPreview: { width: 120, height: 120 },
  touchIndicator: { position: 'absolute', width: 50, height: 50, borderRadius: 25, borderWidth: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
  padStatus: { textAlign: 'center', marginTop: 50, fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center' },
  popCard: { width: 300, backgroundColor: 'white', borderRadius: 45, padding: 35, alignItems: 'center', borderWidth: 4, borderColor: COLORS.dark },
  popIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  popTitle: { fontSize: 24, fontWeight: '900', color: COLORS.dark, textAlign: 'center' },
  popDesc: { color: COLORS.gray, textAlign: 'center', marginVertical: 15, fontWeight: '700' },
  popBtn: { backgroundColor: COLORS.dark, paddingHorizontal: 35, paddingVertical: 18, borderRadius: 22 },
  popBtnText: { color: COLORS.yellow, fontWeight: '900' },
  victoryCard: { width: 320, backgroundColor: COLORS.bg, borderRadius: 50, padding: 40, alignItems: 'center', borderWidth: 4, borderColor: COLORS.dark },
  victoryTitle: { fontSize: 32, fontWeight: '900', color: COLORS.dark },
  victoryImgWrap: { marginVertical: 30, padding: 25, backgroundColor: 'white', borderRadius: 25, shadowColor: '#000', shadowOffset: {width: 0, height: 5}, shadowOpacity: 0.1 },
  victoryDesc: { textAlign: 'center', color: COLORS.brown, fontWeight: 'bold', marginBottom: 30, lineHeight: 20 },
  victoryBtn: { backgroundColor: COLORS.dark, paddingHorizontal: 40, paddingVertical: 18, borderRadius: 25 },
  victoryBtnText: { color: COLORS.yellow, fontWeight: '900' },
  scannerUI: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scannerFrame: { width: 250, height: 250, position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: COLORS.yellow, borderWidth: 5, borderRadius: 10 },
  scannerText: { color: 'white', marginTop: 40, fontWeight: '900', letterSpacing: 1 },
  scannerClose: { position: 'absolute', top: 60, right: 30, padding: 10 }
});