import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { database, get, onValue, ref, update } from '../../services/firebaseDatabase';

const SEASON = '2027';
const CATEGORIES = [['deadline', 'Prazos'], ['result', 'Resultados'], ['competition', 'Torneios'], ['resenha', 'Resenhas'], ['general', 'Geral']];
const blankPost = { title: '', body: '', roundId: '' };
const blankNotification = { title: '', body: '', category: 'general' };

export default function ContentManager({ players = [], memberships = {}, adminUid }) {
  const [feed, setFeed] = useState({}); const [sent, setSent] = useState({}); const [rounds, setRounds] = useState({});
  const [postDraft, setPostDraft] = useState(blankPost); const [notificationDraft, setNotificationDraft] = useState(blankNotification); const [editing, setEditing] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => {
    const stops = [
      onValue(ref(database, `seasons/${SEASON}/feed`), s => setFeed(s.val() || {})),
      onValue(ref(database, `seasons/${SEASON}/notifications`), s => setSent(s.val() || {})),
      onValue(ref(database, `seasons/${SEASON}/rounds`), s => setRounds(s.val() || {})),
    ]; return () => stops.forEach(stop => stop());
  }, []);
  const eligible = useMemo(() => players.filter(p => memberships[p.uid]?.eligible === true), [players, memberships]);
  const posts = Object.entries(feed).map(([id, item]) => ({ id, ...item })).sort((a,b) => Number(b.updatedAt || b.createdAt || 0)-Number(a.updatedAt || a.createdAt || 0));
  const notifications = Object.entries(sent).map(([id,item])=>({id,...item})).sort((a,b)=>Number(b.sentAt||0)-Number(a.sentAt||0));
  const savePost = async (publish) => {
    if (!postDraft.title.trim() || !postDraft.body.trim()) { setMessage('Preencha o título e o texto da resenha.'); return; }
    const id = editing || `post_${Date.now()}`, now = Date.now(), old = feed[id] || {};
    const item = { ...old, ...postDraft, title:postDraft.title.trim(), body:postDraft.body.trim(), season:Number(SEASON), status:publish?'published':'draft', createdAt:old.createdAt||now, createdBy:old.createdBy||adminUid, updatedAt:now, updatedBy:adminUid, ...(publish?{publishedAt:old.publishedAt||now,publishedBy:old.publishedBy||adminUid}:{}) };
    setBusy(true); setMessage('');
    try { const writes = { [`seasons/${SEASON}/feed/${id}`]:item, [`seasons/${SEASON}/audit/content_${id}_${now}`]:{action:publish?'publish':'save_draft',actor:adminUid,at:now,previous:old} }; if(editing) writes[`backups/seasons/${SEASON}/feed/${id}/${now}`]={createdAt:now,createdBy:adminUid,data:old}; await update(ref(database),writes); setPostDraft(blankPost);setEditing('');setMessage(publish?'Resenha publicada.':'Rascunho salvo.'); }
    catch { setMessage('Não foi possível salvar a resenha.'); } finally { setBusy(false); }
  };
  const editPost = post => { setPostDraft({title:post.title||'',body:post.body||'',roundId:post.roundId||''});setEditing(post.id);setMessage(''); };
  const publishNotification = async () => {
    if (!notificationDraft.title.trim() || !notificationDraft.body.trim()) { setMessage('Preencha título e mensagem da notificação.');return; }
    setBusy(true);setMessage('');
    try {
      const targets = eligible; const allowed = await Promise.all(targets.map(async p => { const snap=await get(ref(database,`users/${p.uid}/notificationPreferences/${notificationDraft.category}`));return snap.val() !== false ? p.uid : null; }));
      const id=`notification_${Date.now()}`, now=Date.now(), recipients=allowed.filter(Boolean), item={title:notificationDraft.title.trim(),body:notificationDraft.body.trim(),category:notificationDraft.category,season:Number(SEASON),status:'sent',createdAt:now,sentAt:now,sentBy:adminUid,recipientCount:recipients.length};
      const writes={[`seasons/${SEASON}/notifications/${id}`]:item,[`seasons/${SEASON}/audit/notification_${id}`]:{action:'send_in_app',actor:adminUid,at:now,recipientCount:recipients.length}};
      recipients.forEach(uid=>{writes[`users/${uid}/notifications/${SEASON}/${id}`]={...item,read:false};});
      await update(ref(database),writes);setNotificationDraft(blankNotification);setMessage(`Notificação interna enviada para ${recipients.length} jogadores. Preferências respeitadas.`);
    } catch { setMessage('Não foi possível enviar. Verifique as regras e a conexão do banco.'); } finally { setBusy(false); }
  };
  return <View style={s.root}>
    <View style={s.heading}><View style={{flex:1}}><Text style={s.title}>Conteúdo e Notificações</Text><Text style={s.muted}>Resenhas revisadas e mensagens internas da temporada 2027.</Text></View><MaterialDesignIcons name="text-box-edit-outline" size={24} color="#B9F276"/></View>
    <View style={s.stats}><Text style={s.stat}>{eligible.length} jogadores aptos</Text><Text style={s.stat}>{posts.filter(p=>p.status==='published').length} resenhas publicadas</Text></View>
    <View style={s.panel}><Text style={s.panelTitle}>{editing?'Editar resenha':'Nova resenha'}</Text><TextInput style={s.input} placeholder="Título" placeholderTextColor="#8098B2" value={postDraft.title} onChangeText={title=>setPostDraft(d=>({...d,title}))}/>
      <Text style={s.label}>RODADA (OPCIONAL)</Text><View style={s.chips}><Chip label="Sem rodada" active={!postDraft.roundId} onPress={()=>setPostDraft(d=>({...d,roundId:''}))}/>{Object.entries(rounds).map(([id,r])=><Chip key={id} label={`Rodada ${r.number??id}`} active={postDraft.roundId===id} onPress={()=>setPostDraft(d=>({...d,roundId:id}))}/>)}</View>
      <TextInput style={[s.input,s.textarea]} multiline placeholder="Texto da resenha" placeholderTextColor="#8098B2" value={postDraft.body} onChangeText={body=>setPostDraft(d=>({...d,body}))}/>
      <View style={s.actions}><Button label="Salvar rascunho" icon="content-save-outline" secondary onPress={()=>savePost(false)} disabled={busy}/><Button label="Publicar resenha" icon="publish" onPress={()=>savePost(true)} disabled={busy}/></View>
      <Text style={s.panelTitle}>Notificação interna</Text><Text style={s.muted}>Enviada aos jogadores aptos que não desativaram esta categoria. O app salva a mensagem na caixa de entrada; envio push será conectado a um serviço seguro depois.</Text>
      <View style={s.chips}>{CATEGORIES.map(([id,label])=><Chip key={id} label={label} active={notificationDraft.category===id} onPress={()=>setNotificationDraft(d=>({...d,category:id}))}/>)}</View>
      <TextInput style={s.input} placeholder="Título da notificação" placeholderTextColor="#8098B2" value={notificationDraft.title} onChangeText={title=>setNotificationDraft(d=>({...d,title}))}/><TextInput style={[s.input,s.textareaSmall]} multiline placeholder="Mensagem" placeholderTextColor="#8098B2" value={notificationDraft.body} onChangeText={body=>setNotificationDraft(d=>({...d,body}))}/>
      <Button label={busy?'Salvando…':'Enviar notificação interna'} icon="send-outline" onPress={publishNotification} disabled={busy}/>
      {!!message&&<Text style={s.message}>{message}</Text>}
    </View>
    <View style={s.panel}><Text style={s.panelTitle}>Resenhas · histórico editorial</Text>{posts.map(p=><View key={p.id} style={s.row}><View style={{flex:1}}><Text style={s.rowTitle}>{p.title}</Text><Text style={s.muted}>{p.status==='published'?'Publicada':'Rascunho'} · {p.roundId?`Rodada ${rounds[p.roundId]?.number??p.roundId}`:'Sem rodada'}</Text></View><Pressable accessibilityRole="button" onPress={()=>editPost(p)}><MaterialDesignIcons name="pencil-outline" size={18} color="#B9F276"/></Pressable></View>)}{!posts.length&&<Text style={s.muted}>Ainda não há resenhas.</Text>}</View>
    <View style={s.panel}><Text style={s.panelTitle}>Notificações enviadas</Text>{notifications.slice(0,30).map(n=><View key={n.id} style={s.row}><View style={{flex:1}}><Text style={s.rowTitle}>{n.title}</Text><Text style={s.muted}>{CATEGORIES.find(c=>c[0]===n.category)?.[1]||'Geral'} · {n.recipientCount||0} destinatários</Text></View><MaterialDesignIcons name="check-circle-outline" size={17} color="#B9F276"/></View>)}{!notifications.length&&<Text style={s.muted}>Nenhuma notificação enviada.</Text>}</View>
  </View>;
}
function Chip({label,active,onPress}){return <Pressable onPress={onPress} style={[s.chip,active&&s.chipActive]}><Text style={[s.chipText,active&&s.chipTextActive]}>{label}</Text></Pressable>}
function Button({label,icon,onPress,secondary,disabled}){return <Pressable disabled={disabled} onPress={onPress} style={[s.button,secondary&&s.buttonSecondary,disabled&&{opacity:.5}]}>{disabled?<ActivityIndicator color="#0A2342"/>:<MaterialDesignIcons name={icon} size={17} color={secondary?'#D7E3EF':'#092447'}/>}<Text style={[s.buttonText,secondary&&s.buttonTextSecondary]}>{label}</Text></Pressable>}
const s=StyleSheet.create({root:{gap:12,paddingTop:10,paddingBottom:28},heading:{flexDirection:'row',alignItems:'center',gap:10},title:{color:'#F4F7FB',fontSize:21,fontWeight:'900'},muted:{color:'#9FB5CB',fontSize:9,lineHeight:14,marginTop:4},stats:{flexDirection:'row',flexWrap:'wrap',gap:7},stat:{color:'#B9F276',backgroundColor:'#102844',padding:9,borderRadius:8,fontSize:9,fontWeight:'800'},panel:{gap:9,padding:12,borderRadius:13,borderWidth:1,borderColor:'#29496B',backgroundColor:'#0C2547'},panelTitle:{color:'#F0F5FA',fontWeight:'900',fontSize:12,marginTop:4},input:{minHeight:38,paddingHorizontal:10,borderRadius:8,borderWidth:1,borderColor:'#3A5874',backgroundColor:'#0A1F3A',color:'#F2F6FA',fontSize:10},textarea:{minHeight:150,textAlignVertical:'top',paddingTop:10},textareaSmall:{minHeight:74,textAlignVertical:'top',paddingTop:9},label:{color:'#9FB5CB',fontSize:8,fontWeight:'900'},chips:{flexDirection:'row',flexWrap:'wrap',gap:5},chip:{paddingHorizontal:8,minHeight:27,justifyContent:'center',borderWidth:1,borderColor:'#36536F',borderRadius:7,backgroundColor:'#102844'},chipActive:{backgroundColor:'#383321',borderColor:'#756C40'},chipText:{color:'#AFC2D5',fontSize:8,fontWeight:'800'},chipTextActive:{color:'#F8E7A1'},actions:{flexDirection:'row',flexWrap:'wrap',gap:7},button:{minHeight:38,paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderRadius:8,backgroundColor:'#B9F276'},buttonSecondary:{backgroundColor:'#183653',borderWidth:1,borderColor:'#36536F'},buttonText:{color:'#092447',fontSize:9,fontWeight:'900'},buttonTextSecondary:{color:'#D7E3EF'},message:{color:'#F5D05A',fontSize:9,lineHeight:14},row:{minHeight:42,flexDirection:'row',alignItems:'center',gap:8,borderTopWidth:1,borderTopColor:'rgba(153,182,211,.12)'},rowTitle:{color:'#DDE8F4',fontSize:10,fontWeight:'800'}});
