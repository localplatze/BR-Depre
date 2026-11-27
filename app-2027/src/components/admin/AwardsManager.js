import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { database, onValue, ref, update } from '../../services/firebaseDatabase';

const SEASON = '2027';
const CONFIG_PATH = `seasons/${SEASON}/awardConfig`;
const SPLIT_DEFAULT = { superliga: '60', supercopa: '25', libertadores: '5', administration: '10' };
const INTERNAL_DEFAULT = { superliga: { winner: '75', runnerUp: '20', third: '5' }, supercopa: { winner: '75', runnerUp: '20', third: '5' }, libertadores: { winner: '100' } };

export default function AwardsManager({ players = [], memberships = {}, adminUid }) {
  const [config, setConfig] = useState({});
  const [awards, setAwards] = useState({});
  const [standings, setStandings] = useState({});
  const [league, setLeague] = useState({});
  const [fee, setFee] = useState('');
  const [splits, setSplits] = useState(SPLIT_DEFAULT);
  const [internal, setInternal] = useState(INTERNAL_DEFAULT);
  const [adjustments, setAdjustments] = useState([]);
  const [adjustment, setAdjustment] = useState({ label: '', amount: '', direction: 'income', reason: '' });
  const [awardDraft, setAwardDraft] = useState({ title: '', description: '', playerId: '', reason: '' });
  const [relegationReason, setRelegationReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const stopConfig = onValue(ref(database, CONFIG_PATH), (snapshot) => {
      const value = snapshot.val() || {};
      setConfig(value); setFee(value.registrationFee == null ? '' : String(value.registrationFee));
      setSplits({ ...SPLIT_DEFAULT, ...(value.destinationSplits || {}) });
      setInternal({ superliga: { ...INTERNAL_DEFAULT.superliga, ...(value.internalSplits?.superliga || {}) }, supercopa: { ...INTERNAL_DEFAULT.supercopa, ...(value.internalSplits?.supercopa || {}) }, libertadores: { ...INTERNAL_DEFAULT.libertadores, ...(value.internalSplits?.libertadores || {}) } });
      setAdjustments(asArray(value.adjustments)); setLoading(false);
    }, () => { setLoading(false); setMessage('Não foi possível carregar as regras de premiação.'); });
    const stopAwards = onValue(ref(database, `seasons/${SEASON}/awards`), (snapshot) => setAwards(snapshot.val() || {}));
    const stopLeague = onValue(ref(database, `tournaments/superliga/${SEASON}`), (snapshot) => { const value = snapshot.val() || {}; setLeague(value); setStandings(value.regular?.standings || value.regular?.table || {}); });
    return () => { stopConfig(); stopAwards(); stopLeague(); };
  }, []);

  const eligible = useMemo(() => players.filter((player) => memberships[player.uid]?.eligible === true), [players, memberships]);
  const eligibleIds = useMemo(() => new Set(eligible.map((player) => player.uid)), [eligible]);
  const playerById = useMemo(() => Object.fromEntries(players.map((player) => [player.uid, player])), [players]);
  const paymentCounts = eligible.reduce((result, player) => { const status = memberships[player.uid]?.payment?.status; if (status === 'exempt') result.exempt += 1; else if (status === 'paid') result.paid += 1; else result.pending += 1; return result; }, { paid: 0, exempt: 0, pending: 0 });
  const feeAmount = Number(fee) || 0;
  const confirmedRevenue = paymentCounts.paid * feeAmount;
  const forecastRevenue = (paymentCounts.paid + paymentCounts.pending) * feeAmount;
  const adjustmentTotal = adjustments.reduce((sum, item) => sum + (item.direction === 'income' ? 1 : -1) * (Number(item.amount) || 0), 0);
  const distributable = Math.max(0, confirmedRevenue + adjustmentTotal);
  const splitSum = Object.values(splits).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const finalStandings = standingsRows(standings);
  const cutoff = Number(league.config?.cutoffBrasileiraoRound || league.regular?.cutoffBrasileiraoRound || 30);
  const relegationReady = ['complete', 'finished', 2, '2'].includes(league.regular?.status) && cutoff === 30 && finalStandings.length > 4;
  const relegated = relegationReady ? finalStandings.slice(-4) : [];
  const activeAwardRows = Object.entries(awards).map(([id, award]) => ({ id, ...award })).filter((award) => award.status !== 'revoked').sort((a, b) => Number(b.awardedAt || 0) - Number(a.awardedAt || 0));
  const hasRelegationBadges = new Set(activeAwardRows.filter((award) => award.type === 'relegation' && award.season === Number(SEASON)).map((award) => award.playerId));

  function setSplit(key, value) { setSplits((current) => ({ ...current, [key]: value.replace(/[^0-9]/g, '') })); }
  function setInternalSplit(competition, key, value) { setInternal((current) => ({ ...current, [competition]: { ...current[competition], [key]: value.replace(/[^0-9]/g, '') } })); }
  function addAdjustment() {
    const amount = Number(adjustment.amount);
    if (!adjustment.label.trim() || !adjustment.reason.trim() || !Number.isFinite(amount) || amount <= 0) { setMessage('Informe descrição, valor positivo e motivo do ajuste.'); return; }
    setAdjustments((current) => [...current, { ...adjustment, id: `adj-${Date.now()}`, amount, createdAt: Date.now(), createdBy: adminUid }]);
    setAdjustment({ label: '', amount: '', direction: 'income', reason: '' }); setMessage('Ajuste incluído no rascunho. Salve a configuração para registrar.');
  }

  async function saveConfig() {
    if (!adminUid || saving) return;
    if (!Number.isFinite(Number(fee)) || fee.trim() === '' || Number(fee) < 0) { setMessage('Informe o valor da inscrição em reais.'); return; }
    if (Object.values(splits).some((value) => !Number.isInteger(Number(value)) || Number(value) < 0) || splitSum !== 100) { setMessage(`As parcelas por destino precisam somar 100% (agora: ${splitSum}%).`); return; }
    for (const key of ['superliga', 'supercopa']) { if (Object.values(internal[key]).some((value) => !Number.isInteger(Number(value)) || Number(value) < 0) || Object.values(internal[key]).reduce((sum, value) => sum + Number(value), 0) !== 100) { setMessage(`A distribuição interna da ${key === 'superliga' ? 'Superliga' : 'Supercopa'} precisa somar 100%.`); return; } }
    if (Object.values(internal.libertadores).some((value) => !Number.isInteger(Number(value)) || Number(value) < 0) || Object.values(internal.libertadores).reduce((sum, value) => sum + Number(value), 0) !== 100) { setMessage('A distribuição interna da Libertadores precisa somar 100%.'); return; }
    const now = Date.now(); const next = { ...config, registrationFee: Number(fee), destinationSplits: Object.fromEntries(Object.entries(splits).map(([key, value]) => [key, Number(value)])), internalSplits: Object.fromEntries(Object.entries(internal).map(([key, rows]) => [key, Object.fromEntries(Object.entries(rows).map(([place, value]) => [place, Number(value)]))])), adjustments, adjustedAt: now, adjustedBy: adminUid, version: '2027.1' };
    setSaving(true); setMessage('');
    try { const updates = { [CONFIG_PATH]: next }; if (Object.keys(config).length) updates[`backups/seasons/${SEASON}/awardConfig/${now}`] = { createdAt: now, createdBy: adminUid, data: config }; await update(ref(database), updates); setMessage('Premiação salva com backup da configuração anterior.'); }
    catch { setMessage('Não foi possível salvar a premiação. Confira a conexão e as regras do banco.'); }
    finally { setSaving(false); }
  }

  async function createManualAward() {
    if (!adminUid || saving) return;
    if (!awardDraft.title.trim() || !awardDraft.description.trim() || !awardDraft.playerId || !awardDraft.reason.trim()) { setMessage('Preencha título, descrição, jogador e critério/motivo da conquista.'); return; }
    if (!eligibleIds.has(awardDraft.playerId)) { setMessage('Conquistas da temporada 2027 só podem ser atribuídas a jogadores aptos.'); return; }
    const now = Date.now(); const id = `award-${now}`;
    const award = { id, title: awardDraft.title.trim(), description: awardDraft.description.trim(), playerId: awardDraft.playerId, type: 'manual', criterion: awardDraft.reason.trim(), source: 'manual-admin', season: Number(SEASON), awardedAt: now, awardedBy: adminUid, status: 'active', version: '2027.1' };
    setSaving(true); setMessage('');
    try { await update(ref(database), { [`seasons/${SEASON}/awards/${id}`]: award, [`users/${award.playerId}/achievements/${SEASON}/${id}`]: award, [`seasons/${SEASON}/audit/${id}`]: { action: 'award_manual', actor: adminUid, at: now, playerId: award.playerId, criterion: award.criterion } }); setAwardDraft({ title: '', description: '', playerId: '', reason: '' }); setMessage('Conquista registrada no histórico do jogador.'); }
    catch { setMessage('Não foi possível registrar a conquista. Confira a conexão e as regras do banco.'); }
    finally { setSaving(false); }
  }

  async function issueRelegationBadges() {
    if (!relegationReady) { setMessage('O badge só pode ser emitido após concluir a classificação da Superliga no corte da 30ª rodada.'); return; }
    if (!relegationReason.trim()) { setMessage('Registre o critério e o motivo da emissão automática antes de continuar.'); return; }
    const missing = relegated.filter((entry) => !hasRelegationBadges.has(entry.playerId));
    if (!missing.length) { setMessage('Os quatro badges de rebaixamento já estão registrados.'); return; }
    const now = Date.now(); const updates = {};
    missing.forEach((entry) => {
      const id = `rebaixamento-${entry.playerId}`;
      const award = { id, title: 'Rebaixado na Superliga 2027', description: `Terminou na posição ${entry.position} após a 30ª rodada.`, playerId: entry.playerId, type: 'relegation', criterion: relegationReason.trim(), source: 'superliga-regular-30', position: entry.position, season: Number(SEASON), awardedAt: now, awardedBy: adminUid, status: 'active', version: '2027.1' };
      updates[`seasons/${SEASON}/awards/${id}`] = award; updates[`users/${entry.playerId}/achievements/${SEASON}/${id}`] = award; updates[`seasons/${SEASON}/audit/${id}`] = { action: 'award_relegation', actor: adminUid, at: now, playerId: entry.playerId, position: entry.position, criterion: award.criterion };
    });
    setSaving(true); setMessage('');
    try { await update(ref(database), updates); setMessage(`${missing.length} badge(s) de rebaixamento registrados com origem e trilha administrativa.`); }
    catch { setMessage('Não foi possível registrar os badges. Confira a conexão e as regras do banco.'); }
    finally { setSaving(false); }
  }

  async function revokeAward(award) {
    if (!award?.id || !awardDraft.reason.trim()) { setMessage('Informe o motivo da correção antes de revogar.'); return; }
    const now = Date.now(); const next = { ...award, status: 'revoked', revokedAt: now, revokedBy: adminUid, revokeReason: awardDraft.reason.trim() };
    setSaving(true); setMessage('');
    try { await update(ref(database), { [`seasons/${SEASON}/awards/${award.id}`]: next, [`users/${award.playerId}/achievements/${SEASON}/${award.id}`]: next, [`backups/seasons/${SEASON}/awards/${award.id}/${now}`]: { createdAt: now, createdBy: adminUid, data: award }, [`seasons/${SEASON}/audit/revoke_${award.id}_${now}`]: { action: 'award_revoked', actor: adminUid, at: now, playerId: award.playerId, reason: awardDraft.reason.trim() } }); setAwardDraft((current) => ({ ...current, reason: '' })); setMessage('Conquista revogada com motivo e cópia de segurança.'); }
    catch { setMessage('Não foi possível revogar a conquista. Confira a conexão e as regras do banco.'); }
    finally { setSaving(false); }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#B9F276" /><Text style={styles.muted}>Carregando premiações e conquistas…</Text></View>;
  return <View style={styles.root}>
    <View style={styles.heading}><View style={styles.flex}><Text style={styles.title}>Premiações e Conquistas 2027</Text><Text style={styles.muted}>Divisão financeira, badges com critério, origem, versão e histórico.</Text></View><MaterialDesignIcons name="trophy-award" size={25} color="#F5D05A" /></View>
    <View style={styles.metrics}><Metric label="APTOS" value={eligible.length} /><Metric label="PAGOS" value={paymentCounts.paid} /><Metric label="ISENTOS" value={paymentCounts.exempt} /><Metric label="PENDENTES" value={paymentCounts.pending} /></View>
    <Panel title="Valor e arrecadação" detail="Isenções não entram na arrecadação. O total confirmado considera pagamentos marcados como recebidos.">
      <Field label="INSCRIÇÃO POR JOGADOR (R$)" value={fee} onChangeText={(value) => setFee(value.replace(',', '.').replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="Defina o valor" />
      <View style={styles.moneyGrid}><Money label="Arrecadado confirmado" value={fee ? confirmedRevenue : null} /><Money label="Projeção dos pendentes" value={fee ? forecastRevenue : null} /><Money label="Total para distribuição" value={fee ? distributable : null} /></View>
    </Panel>
    <Panel title="Distribuição por destino" detail="Valores de referência do plano: 60% Superliga, 25% Supercopa, 5% Libertadores e 10% administração.">
      {[["superliga", "Superliga"], ["supercopa", "Supercopa"], ["libertadores", "Libertadores"], ["administration", "Administração"]].map(([key, label]) => <View key={key} style={styles.splitRow}><Text style={styles.rowLabel}>{label}</Text><Field label="%" value={splits[key]} onChangeText={(value) => setSplit(key, value)} keyboardType="number-pad" compact /><Text style={styles.rowValue}>{fee ? formatMoney(distributable * (Number(splits[key]) || 0) / 100) : '—'}</Text></View>)}
      <Text style={[styles.sum, splitSum === 100 ? styles.good : styles.bad]}>Total: {splitSum}% {splitSum === 100 ? '· válido' : '· precisa somar 100%'}</Text>
      <Text style={styles.subheading}>Distribuição interna dos torneios</Text>
      {[["superliga", "Superliga", ['winner', 'runnerUp', 'third']], ["supercopa", "Supercopa", ['winner', 'runnerUp', 'third']], ["libertadores", "Libertadores", ['winner']]].map(([competition, label, places]) => <View key={competition} style={styles.internalCard}><Text style={styles.rowLabel}>{label}</Text><View style={styles.inline}>{places.map((place) => <Field key={place} label={({ winner: 'Campeão', runnerUp: 'Vice', third: '3º' })[place]} value={internal[competition][place]} onChangeText={(value) => setInternalSplit(competition, place, value)} keyboardType="number-pad" compact />)}</View><Text style={styles.muted}>Subtotais precisam fechar 100% do destino.</Text></View>)}
    </Panel>
    <Panel title="Patrocínios e ajustes" detail="Cada linha altera o fundo distribuível e precisa de motivo. A administração não é descontada novamente como custo.">
      <View style={styles.choices}><Choice label="Patrocínio / entrada" selected={adjustment.direction === 'income'} onPress={() => setAdjustment((current) => ({ ...current, direction: 'income' }))} /><Choice label="Desconto / correção" selected={adjustment.direction === 'deduction'} onPress={() => setAdjustment((current) => ({ ...current, direction: 'deduction' }))} /></View>
      <Field label="DESCRIÇÃO" value={adjustment.label} onChangeText={(value) => setAdjustment((current) => ({ ...current, label: value }))} placeholder="Ex.: patrocinador da rodada" />
      <View style={styles.inline}><Field label="VALOR (R$)" value={adjustment.amount} onChangeText={(value) => setAdjustment((current) => ({ ...current, amount: value.replace(',', '.').replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" compact /><Field label="MOTIVO" value={adjustment.reason} onChangeText={(value) => setAdjustment((current) => ({ ...current, reason: value }))} placeholder="Registro auditável" /></View>
      <Action label="Adicionar ajuste" icon="plus" onPress={addAdjustment} secondary />
      {adjustments.map((item) => <View key={item.id} style={styles.listRow}><View style={styles.flex}><Text style={styles.rowLabel}>{item.label}</Text><Text style={styles.muted}>{item.reason}</Text></View><Text style={[styles.rowValue, item.direction === 'income' ? styles.good : styles.bad]}>{item.direction === 'income' ? '+' : '−'}{formatMoney(Number(item.amount) || 0)}</Text><Pressable accessibilityRole="button" accessibilityLabel="Remover ajuste" onPress={() => setAdjustments((current) => current.filter((row) => row.id !== item.id))}><MaterialDesignIcons name="close-circle-outline" size={18} color="#FF9E91" /></Pressable></View>)}
    </Panel>
    <Panel title="Badge de rebaixamento" detail="A emissão automática exige a classificação encerrada após o corte da 30ª rodada. Uma correção manual pode ser registrada como nova conquista, com justificativa.">
      <Text style={styles.subheading}>Quatro últimos da classificação regular</Text>
      {relegated.map((entry) => <PlayerLine key={entry.playerId} player={playerById[entry.playerId]} detail={`${entry.position}º lugar${hasRelegationBadges.has(entry.playerId) ? ' · badge registrado' : ''}`} />)}
      {!relegationReady && <Text style={styles.muted}>Aguardando encerramento da fase regular da Superliga no corte 30.</Text>}
      <Field label="CRITÉRIO / MOTIVO DA EMISSÃO" value={relegationReason} onChangeText={setRelegationReason} placeholder="Ex.: quatro últimas posições após a rodada 30" />
      <Action label="Registrar badges dos quatro últimos" icon="medal-outline" onPress={issueRelegationBadges} secondary />
    </Panel>
    <Panel title="Conquista manual" detail="Use para títulos e badges com critério definido. Feitos em jogos ainda não têm regra automática aprovada; registre-os manualmente com critério explícito.">
      <Field label="TÍTULO DO BADGE" value={awardDraft.title} onChangeText={(value) => setAwardDraft((current) => ({ ...current, title: value }))} placeholder="Ex.: Campeão da Superliga" />
      <Field label="DESCRIÇÃO" value={awardDraft.description} onChangeText={(value) => setAwardDraft((current) => ({ ...current, description: value }))} placeholder="Texto que aparecerá na conquista" multiline />
      <Text style={styles.fieldLabel}>JOGADOR</Text><PlayerChips players={eligible} selected={awardDraft.playerId} onSelect={(playerId) => setAwardDraft((current) => ({ ...current, playerId }))} />
      <Field label="CRITÉRIO / MOTIVO" value={awardDraft.reason} onChangeText={(value) => setAwardDraft((current) => ({ ...current, reason: value }))} placeholder="Origem verificável da conquista" />
      <Action label="Registrar conquista" icon="trophy-award" onPress={createManualAward} />
    </Panel>
    <Panel title="Conquistas registradas" detail={`${activeAwardRows.length} ativa(s) · dados sincronizados com o histórico do jogador`}>
      {activeAwardRows.map((award) => <View key={award.id} style={styles.awardRow}><MaterialDesignIcons name={award.type === 'relegation' ? 'arrow-down-bold-circle-outline' : 'trophy-outline'} size={19} color={award.type === 'relegation' ? '#FF9E91' : '#F5D05A'} /><View style={styles.flex}><Text style={styles.rowLabel}>{award.title}</Text><Text style={styles.muted}>{playerById[award.playerId]?.name || award.playerId} · {award.criterion}</Text></View><Pressable accessibilityRole="button" onPress={() => revokeAward(award)}><MaterialDesignIcons name="archive-cancel-outline" size={18} color="#FF9E91" /></Pressable></View>)}
      {!activeAwardRows.length && <Text style={styles.muted}>Nenhuma conquista emitida nesta temporada.</Text>}
      <Field label="MOTIVO PARA CORRIGIR / REVOGAR" value={awardDraft.reason} onChangeText={(value) => setAwardDraft((current) => ({ ...current, reason: value }))} placeholder="Obrigatório para revogação" />
    </Panel>
    {!!message && <Text accessibilityLiveRegion="polite" style={[styles.message, message.startsWith('Não') || message.includes('precisa') || message.includes('Informe') || message.includes('Preencha') || message.includes('Registre') ? styles.error : null]}>{message}</Text>}
    <Pressable accessibilityRole="button" disabled={saving} onPress={saveConfig} style={[styles.save, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#092447" /> : <MaterialDesignIcons name="content-save-outline" size={18} color="#092447" />}<Text style={styles.saveText}>{saving ? 'Salvando…' : 'Salvar configuração de premiação'}</Text></Pressable>
  </View>;
}

function Panel({ title, detail, children }) { return <View style={styles.panel}><Text style={styles.panelTitle}>{title}</Text><Text style={styles.panelDetail}>{detail}</Text><View style={styles.body}>{children}</View></View>; }
function Field({ label, value, onChangeText, placeholder, keyboardType, compact = false, multiline = false }) { return <View style={[styles.field, compact && styles.fieldCompact]}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={String(value ?? '')} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8199B3" keyboardType={keyboardType || 'default'} multiline={multiline} style={[styles.input, multiline && styles.textarea]} /></View>; }
function Metric({ label, value }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Money({ label, value }) { return <View style={styles.money}><Text style={styles.moneyValue}>{value == null ? '—' : formatMoney(value)}</Text><Text style={styles.muted}>{label}</Text></View>; }
function Choice({ label, selected, onPress }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}><Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text></Pressable>; }
function Choices({ options, value, onChange }) { return <View style={styles.choices}>{options.map(([id, label]) => <Choice key={id} label={label} selected={value === id} onPress={() => onChange(id)} />)}</View>; }
function Action({ label, icon, onPress, secondary = false }) { return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, secondary && styles.actionSecondary]}><MaterialDesignIcons name={icon} size={15} color={secondary ? '#D1DEEB' : '#092447'} /><Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text></Pressable>; }
function PlayerChips({ players, selected, onSelect }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{players.map((player) => <Choice key={player.uid} label={player.name} selected={selected === player.uid} onPress={() => onSelect(selected === player.uid ? '' : player.uid)} />)}</ScrollView>; }
function PlayerLine({ player, detail }) { return <View style={styles.playerLine}>{player?.shieldUrl ? <Image source={{ uri: player.shieldUrl }} style={styles.crest} resizeMode="contain" /> : <MaterialDesignIcons name="account-circle-outline" size={23} color="#AFC5DD" />}<Text style={styles.rowLabel}>{player?.name || 'Jogador removido'}</Text><Text style={styles.muted}>{detail}</Text></View>; }
function standingsRows(value) { const entries = Array.isArray(value) ? value.map((row, index) => [row.playerId || row.uid || row.userId || String(index), row]) : Object.entries(value || {}); return entries.map(([id, row], index) => ({ playerId: row.playerId || row.uid || row.userId || id, position: Number(row.position) || index + 1 })).sort((a, b) => a.position - b.position); }
function asArray(value) { return Array.isArray(value) ? value.filter(Boolean) : Object.entries(value || {}).map(([id, item]) => ({ id, ...(item || {}) })); }
function formatMoney(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

const styles = StyleSheet.create({ root: { gap: 12, paddingTop: 10, paddingBottom: 28 }, flex: { flex: 1, minWidth: 0 }, loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { color: '#F6F8FC', fontSize: 22, fontWeight: '900' }, muted: { color: '#9FB5CB', fontSize: 8, lineHeight: 13, marginTop: 3 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, metric: { flexGrow: 1, minWidth: '22%', padding: 9, borderRadius: 9, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, metricValue: { color: '#F5D05A', fontSize: 15, fontWeight: '900' }, metricLabel: { color: '#AFC5DD', fontSize: 7, marginTop: 3 }, panel: { padding: 12, borderRadius: 13, borderWidth: 1, borderColor: '#29496B', backgroundColor: '#0C2547' }, panelTitle: { color: '#F0F5FA', fontSize: 12, fontWeight: '900' }, panelDetail: { color: '#91A9C7', fontSize: 8, lineHeight: 13, marginTop: 4 }, body: { gap: 8, marginTop: 11 }, field: { flex: 1, minWidth: 65 }, fieldCompact: { flex: 0, width: 67 }, fieldLabel: { color: '#9FB5CB', fontSize: 7, letterSpacing: .4, fontWeight: '900', marginBottom: 4 }, input: { minHeight: 35, paddingHorizontal: 8, color: '#F2F6FA', borderRadius: 8, borderWidth: 1, borderColor: '#3A5874', backgroundColor: '#0A1F3A', fontSize: 9 }, textarea: { minHeight: 60, textAlignVertical: 'top', paddingTop: 8 }, moneyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, money: { flexGrow: 1, minWidth: '28%', padding: 8, borderRadius: 8, backgroundColor: '#102844' }, moneyValue: { color: '#F5D05A', fontSize: 10, fontWeight: '900' }, splitRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.1)' }, rowLabel: { flex: 1, color: '#DDE8F4', fontSize: 8, fontWeight: '800' }, rowValue: { minWidth: 65, color: '#F5D05A', fontSize: 9, fontWeight: '900', textAlign: 'right' }, sum: { fontSize: 9, fontWeight: '900' }, good: { color: '#B9F276' }, bad: { color: '#FF9E91' }, subheading: { color: '#C4D3E2', fontSize: 8, fontWeight: '900' }, internalCard: { gap: 5, padding: 8, borderRadius: 8, backgroundColor: '#102844' }, inline: { flexDirection: 'row', gap: 7 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, choice: { minHeight: 29, maxWidth: 170, paddingHorizontal: 8, justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: '#36536F', backgroundColor: '#102844' }, choiceOn: { borderColor: '#756C40', backgroundColor: '#383321' }, choiceText: { color: '#AFC2D5', fontSize: 7, fontWeight: '800' }, choiceTextOn: { color: '#F8E7A1' }, action: { minHeight: 34, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, borderRadius: 8, backgroundColor: '#F5D05A' }, actionSecondary: { backgroundColor: '#183653', borderWidth: 1, borderColor: '#36536F' }, actionText: { color: '#092447', fontSize: 7, fontWeight: '900' }, actionTextSecondary: { color: '#D1DEEB' }, listRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.1)' }, playerLine: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.1)' }, crest: { width: 25, height: 28 }, awardRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderTopWidth: 1, borderTopColor: 'rgba(153,182,211,.1)' }, chips: { gap: 5, paddingVertical: 3 }, message: { color: '#F5D05A', fontSize: 8, lineHeight: 13 }, error: { color: '#FFB5A9' }, save: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 9, backgroundColor: '#F5D05A' }, saveText: { color: '#092447', fontSize: 8, fontWeight: '900' }, disabled: { opacity: .5 } });
