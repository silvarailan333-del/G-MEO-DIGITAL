import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

export interface ExecutiveReportPayload {
  companyName: string;
  environmentLabel: string;
  generatedAt: string;
  indicators: Array<{ label: string; value: string; source: string; date: string }>;
  analyses: Array<{ title: string; summary: string }>;
  recommendations: Array<{ title: string; impact: string; priority: string }>;
  sources: string[];
  limitations: string[];
  companyDiagnosis?: string[];
  marketSummary?: string[];
  competitorAnalyses?: Array<{ name: string; summary: string; threatLevel: string }>;
  threatsAndOpportunities?: Array<{ kind: string; title: string; summary: string }>;
  approvedDecisions?: Array<{ title: string; outcome: string; dueDate: string }>;
  actionPlansSummary?: Array<{ title: string; status: string; owner: string; dueDate: string }>;
  kpiSummary?: Array<{ group: string; label: string; value: string }>;
}

export function exportExecutiveReportPDF(payload: ExecutiveReportPayload) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 42;
  const maxW = pageWidth - margin * 2;

  const ensureSpace = (needed = 40) => {
    if (y + needed > 780) {
      doc.addPage();
      y = 48;
    }
  };

  doc.setFillColor(11, 25, 44);
  doc.rect(0, 0, pageWidth, 86, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.text('GÊMEO DIGITAL — RELATÓRIO EXECUTIVO', margin, 38);
  doc.setFontSize(10);
  doc.setTextColor(103, 232, 249);
  doc.text(
    `${payload.companyName}  |  ${payload.environmentLabel}  |  Emitido em ${payload.generatedAt}`,
    margin,
    60
  );

  y = 112;
  doc.setTextColor(15, 23, 42);

  const addSectionTitle = (title: string) => {
    ensureSpace(36);
    doc.setFontSize(12);
    doc.setTextColor(15, 41, 74);
    doc.text(title, margin, y);
    y += 8;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
  };

  const addBullets = (items: string[]) => {
    for (const text of items) {
      ensureSpace(26);
      const lines = doc.splitTextToSize(`• ${text}`, maxW);
      doc.text(lines, margin, y);
      y += lines.length * 14 + 4;
    }
  };

  const hasConsolidated = Boolean(
    payload.companyDiagnosis ||
      payload.marketSummary ||
      payload.competitorAnalyses ||
      payload.threatsAndOpportunities ||
      payload.approvedDecisions ||
      payload.actionPlansSummary ||
      payload.kpiSummary
  );

  if (hasConsolidated) {
    if (payload.companyDiagnosis?.length) {
      addSectionTitle('1. Diagnóstico da Empresa');
      addBullets(payload.companyDiagnosis);
      y += 6;
    }

    if (payload.marketSummary?.length) {
      addSectionTitle('2. Situação do Mercado');
      addBullets(payload.marketSummary);
      y += 6;
    }

    addSectionTitle('3. Análise dos Concorrentes');
    if (payload.competitorAnalyses?.length) {
      addBullets(
        payload.competitorAnalyses.map(
          (c) => `${c.name} [${c.threatLevel}]: ${c.summary}`
        )
      );
    } else {
      addBullets(['Nenhum concorrente cadastrado ou monitorado até o momento.']);
    }
    y += 6;

    addSectionTitle('4. Indicadores Macroeconômicos');
    addBullets(
      payload.indicators.map(
        (ind) => `${ind.label}: ${ind.value} (Fonte: ${ind.source} | Ref: ${ind.date})`
      )
    );
    y += 6;

    addSectionTitle('5. Principais Ameaças e Oportunidades');
    if (payload.threatsAndOpportunities?.length) {
      addBullets(
        payload.threatsAndOpportunities.map(
          (t) => `[${t.kind.toUpperCase()}] ${t.title}: ${t.summary}`
        )
      );
    } else if (payload.analyses.length) {
      addBullets(payload.analyses.map((a) => `${a.title}: ${a.summary}`));
    }
    y += 6;

    addSectionTitle('6. Decisões Aprovadas e Recomendações');
    if (payload.approvedDecisions?.length) {
      addBullets(
        payload.approvedDecisions.map(
          (d) => `[APROVADA] ${d.title} — Prazo: ${d.dueDate} — Resultado esperado: ${d.outcome}`
        )
      );
    }
    if (payload.recommendations.length) {
      addBullets(
        payload.recommendations.map(
          (r) => `[${r.priority.toUpperCase()}] ${r.title} — Impacto: ${r.impact}`
        )
      );
    }
    y += 6;

    addSectionTitle('7. Planos de Ação');
    if (payload.actionPlansSummary?.length) {
      addBullets(
        payload.actionPlansSummary.map(
          (p) => `${p.title} [${p.status}] — Resp.: ${p.owner} | Prazo: ${p.dueDate}`
        )
      );
    } else {
      addBullets(['Nenhuma tarefa de plano de ação gerada até o momento.']);
    }
    y += 6;

    addSectionTitle('8. Resultados e Indicadores de Desempenho');
    if (payload.kpiSummary?.length) {
      addBullets(payload.kpiSummary.map((k) => `[${k.group}] ${k.label}: ${k.value}`));
    }
    y += 6;
  } else {
    addSectionTitle('1. Indicadores Monitorados');
    addBullets(
      payload.indicators.map(
        (ind) => `${ind.label}: ${ind.value} (Fonte: ${ind.source} | Ref: ${ind.date})`
      )
    );

    y += 8;
    addSectionTitle('2. Análises Estratégicas');
    addBullets(payload.analyses.map((a) => `${a.title}: ${a.summary}`));

    y += 8;
    addSectionTitle('3. Recomendações e Decisões Prioritárias');
    addBullets(
      payload.recommendations.map(
        (r) => `[${r.priority.toUpperCase()}] ${r.title} — Impacto: ${r.impact}`
      )
    );
  }

  y += 6;
  addSectionTitle('Fontes e Limitações Metodológicas');
  for (const src of payload.sources) {
    ensureSpace(20);
    const lines = doc.splitTextToSize(`Fonte: ${src}`, maxW);
    doc.text(lines, margin, y);
    y += lines.length * 14;
  }
  y += 4;
  for (const lim of payload.limitations) {
    ensureSpace(24);
    const lines = doc.splitTextToSize(`Limitação: ${lim}`, maxW);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 2;
  }

  const slug = payload.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  doc.save(`relatorio-gemeo-digital-${slug}.pdf`);
}

export function exportExecutiveReportExcel(payload: ExecutiveReportPayload) {
  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet([
    {
      Empresa: payload.companyName,
      Ambiente: payload.environmentLabel,
      Emitido_Em: payload.generatedAt,
      Diagnostico: (payload.companyDiagnosis || []).join(' | '),
      Situacao_Mercado: (payload.marketSummary || []).join(' | '),
      Fontes: payload.sources.join(' | '),
      Limitacoes: payload.limitations.join(' | '),
    },
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumo');

  const indicatorsSheet = XLSX.utils.json_to_sheet(
    payload.indicators.map((i) => ({
      Indicador: i.label,
      Valor: i.value,
      Fonte: i.source,
      Data_Referencia: i.date,
    }))
  );
  XLSX.utils.book_append_sheet(wb, indicatorsSheet, 'Indicadores_Macro');

  if (payload.competitorAnalyses?.length) {
    const compSheet = XLSX.utils.json_to_sheet(
      payload.competitorAnalyses.map((c) => ({
        Concorrente: c.name,
        Nivel_Ameaca: c.threatLevel,
        Sintese: c.summary,
      }))
    );
    XLSX.utils.book_append_sheet(wb, compSheet, 'Concorrentes');
  }

  const analysesSheet = XLSX.utils.json_to_sheet(
    payload.analyses.map((a) => ({
      Titulo: a.title,
      Sintese: a.summary,
    }))
  );
  XLSX.utils.book_append_sheet(wb, analysesSheet, 'Analises');

  const recsSheet = XLSX.utils.json_to_sheet(
    payload.recommendations.map((r) => ({
      Recomendacao: r.title,
      Prioridade: r.priority,
      Impacto: r.impact,
    }))
  );
  XLSX.utils.book_append_sheet(wb, recsSheet, 'Decisoes_Recomendacoes');

  if (payload.approvedDecisions?.length) {
    const approvedSheet = XLSX.utils.json_to_sheet(
      payload.approvedDecisions.map((d) => ({
        Decisao_Aprovada: d.title,
        Resultado_Esperado: d.outcome,
        Prazo: d.dueDate,
      }))
    );
    XLSX.utils.book_append_sheet(wb, approvedSheet, 'Decisoes_Aprovadas');
  }

  if (payload.actionPlansSummary?.length) {
    const plansSheet = XLSX.utils.json_to_sheet(
      payload.actionPlansSummary.map((p) => ({
        Atividade: p.title,
        Status: p.status,
        Responsavel: p.owner,
        Prazo: p.dueDate,
      }))
    );
    XLSX.utils.book_append_sheet(wb, plansSheet, 'Planos_de_Acao');
  }

  if (payload.kpiSummary?.length) {
    const kpiSheet = XLSX.utils.json_to_sheet(
      payload.kpiSummary.map((k) => ({
        Grupo: k.group,
        Indicador: k.label,
        Valor: k.value,
      }))
    );
    XLSX.utils.book_append_sheet(wb, kpiSheet, 'Resultados_KPIs');
  }

  const slug = payload.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  XLSX.writeFile(wb, `relatorio-gemeo-digital-${slug}.xlsx`);
}

export function downloadImportTemplateExcel() {
  const wb = XLSX.utils.book_new();
  const sample = [
    {
      Data_YYYY_MM_DD: '2026-10-01',
      Faturamento_Reais: 18500,
      Quantidade_Pedidos: 92,
      Perdas_Reais: 320,
      Observacao: 'Vendas consolidadas da loja e site',
    },
    {
      Data_YYYY_MM_DD: '2026-11-01',
      Faturamento_Reais: 21400,
      Quantidade_Pedidos: 105,
      Perdas_Reais: 290,
      Observacao: 'Campanha sazonal',
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(sample);
  XLSX.utils.book_append_sheet(wb, sheet, 'Modelo_Metricas');
  XLSX.writeFile(wb, 'modelo-importacao-gemeo-digital.xlsx');
}

export function downloadCatalogTemplateExcel() {
  const wb = XLSX.utils.book_new();
  const sample = [
    {
      Codigo: 'PROD-001',
      Nome_Produto: 'Exemplo Produto A',
      Preco_Unitario: 149.9,
      Custo_Unitario: 68.0,
      Estoque_Atual: 45,
      Categoria: 'Linha Principal',
    },
    {
      Codigo: 'PROD-002',
      Nome_Produto: 'Exemplo Produto B',
      Preco_Unitario: 89.5,
      Custo_Unitario: 39.0,
      Estoque_Atual: 12,
      Categoria: 'Acessórios',
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(sample);
  XLSX.utils.book_append_sheet(wb, sheet, 'Catalogo_Estoque');
  XLSX.writeFile(wb, 'modelo-catalogo-estoque-gemeo-digital.xlsx');
}

export function downloadSalesUnitsTemplateExcel() {
  const wb = XLSX.utils.book_new();
  const sample = [
    {
      Codigo: 'PROD-001',
      Nome_Produto: 'Exemplo Produto A',
      Unidades_Vendidas: 128,
      Preco_Unitario: 149.9,
    },
    {
      Codigo: 'PROD-002',
      Nome_Produto: 'Exemplo Produto B',
      Unidades_Vendidas: 64,
      Preco_Unitario: 89.5,
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(sample);
  XLSX.utils.book_append_sheet(wb, sheet, 'Unidades_Vendidas');
  XLSX.writeFile(wb, 'modelo-unidades-vendidas-gemeo-digital.xlsx');
}

export interface AiExecutiveReportExportPayload {
  companyName: string;
  segment: string;
  cityState: string;
  generatedAt: string;
  executiveSummary: string;
  sectorContext: string;
  financialHealth: {
    statusLabel: string;
    summary: string;
    keyNumbers: string[];
  };
  competitivePosition: {
    summary: string;
    advantages: string[];
    vulnerabilities: string[];
  };
  consumerDiagnosis: {
    summary: string;
    strengths: string[];
    painPoints: string[];
  };
  opportunities: Array<{ title: string; impact: string; action: string }>;
  risks: Array<{ title: string; severity: string; mitigation: string }>;
  strategicRecommendations: Array<{
    priority: string;
    title: string;
    rationale: string;
    suggestedKpi: string;
  }>;
  dataGaps: string[];
  groundingLinks?: Array<{ title: string; uri: string }>;
}

export function exportAiExecutiveReportPDF(report: AiExecutiveReportExportPayload) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 42;
  const maxW = pageWidth - margin * 2;

  const ensureSpace = (needed = 40) => {
    if (y + needed > 780) {
      doc.addPage();
      y = 48;
    }
  };

  doc.setFillColor(11, 25, 44);
  doc.rect(0, 0, pageWidth, 88, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('GÊMEO DIGITAL AI — DIAGNÓSTICO EXECUTIVO', margin, 36);
  doc.setFontSize(10);
  doc.setTextColor(103, 232, 249);
  doc.text(
    `${report.companyName} | ${report.segment} | ${report.cityState}`,
    margin,
    56
  );
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Gerado em: ${new Date(report.generatedAt).toLocaleString('pt-BR')}`, margin, 72);

  y = 112;

  const addSection = (title: string) => {
    ensureSpace(36);
    doc.setFontSize(12);
    doc.setTextColor(15, 41, 74);
    doc.text(title, margin, y);
    y += 7;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
  };

  const addParagraph = (text: string) => {
    if (!text) return;
    ensureSpace(24);
    const lines = doc.splitTextToSize(text, maxW);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 6;
  };

  const addBullets = (items: string[]) => {
    for (const item of items) {
      if (!item) continue;
      ensureSpace(22);
      const lines = doc.splitTextToSize(`• ${item}`, maxW);
      doc.text(lines, margin, y);
      y += lines.length * 14 + 4;
    }
  };

  addSection('1. Resumo Executivo & Contexto Setorial');
  addParagraph(report.executiveSummary);
  if (report.sectorContext) addParagraph(report.sectorContext);

  addSection(`2. Saúde Financeira (${report.financialHealth.statusLabel})`);
  addParagraph(report.financialHealth.summary);
  if (report.financialHealth.keyNumbers.length) {
    addBullets(report.financialHealth.keyNumbers);
  }

  addSection('3. Posição Competitiva');
  addParagraph(report.competitivePosition.summary);
  if (report.competitivePosition.advantages.length) {
    addBullets(report.competitivePosition.advantages.map((a) => `Vantagem: ${a}`));
  }
  if (report.competitivePosition.vulnerabilities.length) {
    addBullets(report.competitivePosition.vulnerabilities.map((v) => `Vulnerabilidade: ${v}`));
  }

  addSection('4. Diagnóstico dos Consumidores');
  addParagraph(report.consumerDiagnosis.summary);
  if (report.consumerDiagnosis.strengths.length) {
    addBullets(report.consumerDiagnosis.strengths.map((s) => `Elogio recorrente: ${s}`));
  }
  if (report.consumerDiagnosis.painPoints.length) {
    addBullets(report.consumerDiagnosis.painPoints.map((p) => `Ponto de dor: ${p}`));
  }

  addSection('5. Oportunidades e Riscos Estratégicos');
  if (report.opportunities.length) {
    addBullets(
      report.opportunities.map((o) => `[OPORTUNIDADE - ${o.impact}] ${o.title}: ${o.action}`)
    );
  }
  if (report.risks.length) {
    addBullets(report.risks.map((r) => `[RISCO - ${r.severity}] ${r.title}: ${r.mitigation}`));
  }

  addSection('6. Recomendações Estratégicas Prioritárias');
  if (report.strategicRecommendations.length) {
    addBullets(
      report.strategicRecommendations.map(
        (rec) => `[${rec.priority.toUpperCase()}] ${rec.title} — ${rec.rationale} (KPI: ${rec.suggestedKpi})`
      )
    );
  } else {
    addParagraph('Sem recomendações adicionais geradas.');
  }

  if (report.dataGaps.length) {
    addSection('7. Lacunas de Dados Identificadas');
    addBullets(report.dataGaps);
  }

  if (report.groundingLinks && report.groundingLinks.length) {
    addSection('8. Fontes Externas Consultadas');
    addBullets(report.groundingLinks.map((l) => `${l.title}: ${l.uri}`));
  }

  const slug = report.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`diagnostico-gemeo-digital-ai-${slug}.pdf`);
}

