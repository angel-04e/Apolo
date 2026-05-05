#!/usr/bin/env python3
"""
APOLO FITNESS - Generador de Gráficas con Python/Matplotlib
Recibe datos JSON por stdin y genera imágenes PNG en public/charts/
Uso: echo '{"type":"weekly","data":{...},"user_id":1}' | python3 python/charts.py
"""

import sys
import json
import os
import matplotlib
matplotlib.use('Agg')  # Sin interfaz gráfica (servidor)
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from datetime import datetime

#  Tema Apolo (dorado / oscuro) 
BG_DARK    = '#0a0e12'
BG_CARD    = '#12181f'
GOLD       = '#b8996e'
GOLD_LIGHT = '#c9a97a'
GOLD_DIM   = '#8a7252'
TEXT_LIGHT = '#b8bcc4'
TEXT_GRAY  = '#6b7280'
ACCENT     = '#00ADB5'

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'charts')
os.makedirs(OUTPUT_DIR, exist_ok=True)

def apolo_style(fig, ax):
    """Aplica el tema oscuro dorado a matplotlib."""
    fig.patch.set_facecolor(BG_DARK)
    ax.set_facecolor(BG_CARD)
    ax.tick_params(colors=TEXT_LIGHT, labelsize=9)
    ax.xaxis.label.set_color(TEXT_LIGHT)
    ax.yaxis.label.set_color(TEXT_LIGHT)
    ax.title.set_color(GOLD_LIGHT)
    for spine in ax.spines.values():
        spine.set_edgecolor(GOLD_DIM)
        spine.set_linewidth(0.5)
    ax.grid(color='#1e2830', linewidth=0.5, linestyle='--')
    ax.set_axisbelow(True)


#  Gráfica 1: Progreso semanal (línea) 
def chart_weekly_progress(data, user_id):
    days   = data.get('days',   ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'])
    values = data.get('values', [0, 0, 0, 0, 0, 0, 0])

    fig, ax = plt.subplots(figsize=(8, 4))
    apolo_style(fig, ax)

    x = np.arange(len(days))
    ax.fill_between(x, values, alpha=0.15, color=GOLD)
    ax.plot(x, values, color=GOLD, linewidth=2.5, marker='o',
            markersize=6, markerfacecolor=GOLD_LIGHT, markeredgecolor=BG_DARK)

    # Etiquetas encima de cada punto
    for xi, yi in zip(x, values):
        if yi > 0:
            ax.annotate(str(yi), (xi, yi), textcoords='offset points',
                        xytext=(0, 8), ha='center', fontsize=8, color=GOLD_LIGHT)

    ax.set_xticks(x)
    ax.set_xticklabels(days)
    ax.set_ylabel('Rutinas completadas')
    ax.set_title('Progreso Semanal', fontsize=13, fontweight='bold', pad=12)
    ax.set_ylim(bottom=0)

    path = os.path.join(OUTPUT_DIR, f'weekly_{user_id}.png')
    fig.savefig(path, bbox_inches='tight', dpi=150, facecolor=BG_DARK)
    plt.close(fig)
    return path


#  Gráfica 2: Distribución de hábitos (donut) 
def chart_habits_donut(data, user_id):
    labels = data.get('labels', ['Salud', 'Nutrición', 'Descanso', 'Ejercicio'])
    values = data.get('values', [1, 1, 1, 1])

    # Colores Apolo
    colors = [GOLD, GOLD_LIGHT, GOLD_DIM, TEXT_GRAY, ACCENT, '#393E46']

    fig, ax = plt.subplots(figsize=(6, 5))
    fig.patch.set_facecolor(BG_DARK)
    ax.set_facecolor(BG_DARK)

    wedges, texts, autotexts = ax.pie(
        values,
        labels=None,
        colors=colors[:len(values)],
        autopct=lambda p: f'{p:.0f}%' if p > 5 else '',
        startangle=90,
        wedgeprops=dict(width=0.55, edgecolor=BG_DARK, linewidth=2),
        pctdistance=0.75
    )
    for at in autotexts:
        at.set_color(BG_DARK)
        at.set_fontsize(9)
        at.set_fontweight('bold')

    # Leyenda
    patches = [mpatches.Patch(color=colors[i], label=labels[i]) for i in range(len(labels))]
    legend = ax.legend(handles=patches, loc='lower center', bbox_to_anchor=(0.5, -0.12),
                       ncol=2, frameon=False, fontsize=9)
    plt.setp(legend.get_texts(), color=TEXT_LIGHT)

    ax.set_title('Distribución de Hábitos', fontsize=13, fontweight='bold',
                 color=GOLD_LIGHT, pad=10)

    # Texto central
    ax.text(0, 0, f'{sum(values)}\nhábitos', ha='center', va='center',
            fontsize=11, color=GOLD_LIGHT, fontweight='bold')

    path = os.path.join(OUTPUT_DIR, f'habits_{user_id}.png')
    fig.savefig(path, bbox_inches='tight', dpi=150, facecolor=BG_DARK)
    plt.close(fig)
    return path


#  Gráfica 3: Evolución de peso (línea con área) 
def chart_weight_progress(data, user_id):
    dates  = data.get('dates',  [])
    weights = data.get('weights', [])

    if not dates or not weights:
        # Datos demo
        dates   = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6']
        weights = [80, 79.2, 78.5, 78.0, 77.3, 76.8]

    fig, ax = plt.subplots(figsize=(8, 4))
    apolo_style(fig, ax)

    x = np.arange(len(dates))
    ax.fill_between(x, weights, min(weights) - 1, alpha=0.1, color=GOLD)
    ax.plot(x, weights, color=GOLD, linewidth=2.5, marker='o',
            markersize=6, markerfacecolor=GOLD_LIGHT, markeredgecolor=BG_DARK)

    ax.set_xticks(x)
    ax.set_xticklabels(dates, rotation=30, ha='right', fontsize=8)
    ax.set_ylabel('Peso (kg)')
    ax.set_title('Evolución de Peso Corporal', fontsize=13, fontweight='bold', pad=12)

    path = os.path.join(OUTPUT_DIR, f'weight_{user_id}.png')
    fig.savefig(path, bbox_inches='tight', dpi=150, facecolor=BG_DARK)
    plt.close(fig)
    return path


#  Gráfica 4: Calorías semanal (barras) 
def chart_calories(data, user_id):
    days     = data.get('days',   ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'])
    consumed = data.get('consumed', [0] * 7)
    target   = data.get('target',   2000)

    fig, ax = plt.subplots(figsize=(8, 4))
    apolo_style(fig, ax)

    x = np.arange(len(days))
    bar_colors = [GOLD if c <= target else '#e74c3c' for c in consumed]
    bars = ax.bar(x, consumed, color=bar_colors, alpha=0.85, width=0.55,
                  edgecolor=BG_DARK, linewidth=0.5)

    # Línea objetivo
    ax.axhline(target, color=GOLD_DIM, linestyle='--', linewidth=1.2, alpha=0.7)
    ax.text(len(days) - 0.4, target + 30, f'Meta: {target}', color=GOLD_DIM, fontsize=8)

    ax.set_xticks(x)
    ax.set_xticklabels(days)
    ax.set_ylabel('kcal')
    ax.set_title('Calorías Consumidas (semana)', fontsize=13, fontweight='bold', pad=12)

    path = os.path.join(OUTPUT_DIR, f'calories_{user_id}.png')
    fig.savefig(path, bbox_inches='tight', dpi=150, facecolor=BG_DARK)
    plt.close(fig)
    return path


#  Gráfica 5: Racha de hábitos (heatmap mensual simplificado) 
def chart_streak_heatmap(data, user_id):
    """Mapa de calor de actividad del mes (como GitHub contributions)."""
    days_in_month = data.get('days_in_month', 30)
    completed     = set(data.get('completed_days', []))  # lista de números de día

    weeks = (days_in_month + 6) // 7
    matrix = np.zeros((7, weeks))

    for d in range(1, days_in_month + 1):
        week_col = (d - 1) // 7
        day_row  = (d - 1) % 7
        if d in completed:
            matrix[day_row][week_col] = 1

    fig, ax = plt.subplots(figsize=(8, 3))
    fig.patch.set_facecolor(BG_DARK)
    ax.set_facecolor(BG_DARK)

    cmap = matplotlib.colors.LinearSegmentedColormap.from_list(
        'apolo', [BG_CARD, GOLD_DIM, GOLD])
    ax.imshow(matrix, cmap=cmap, aspect='auto', vmin=0, vmax=1)

    day_labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    ax.set_yticks(range(7))
    ax.set_yticklabels(day_labels, fontsize=8, color=TEXT_LIGHT)
    ax.set_xticks([])
    ax.set_title('Actividad del Mes', fontsize=13, fontweight='bold',
                 color=GOLD_LIGHT, pad=10)
    for spine in ax.spines.values():
        spine.set_visible(False)

    path = os.path.join(OUTPUT_DIR, f'streak_{user_id}.png')
    fig.savefig(path, bbox_inches='tight', dpi=150, facecolor=BG_DARK)
    plt.close(fig)
    return path


#  MAIN 
if __name__ == '__main__':
    try:
        payload = json.loads(sys.stdin.read())
        chart_type = payload.get('type')
        data       = payload.get('data', {})
        user_id    = payload.get('user_id', 0)

        dispatch = {
            'weekly':   chart_weekly_progress,
            'habits':   chart_habits_donut,
            'weight':   chart_weight_progress,
            'calories': chart_calories,
            'streak':   chart_streak_heatmap,
        }

        if chart_type not in dispatch:
            print(json.dumps({'error': f'Tipo desconocido: {chart_type}'}))
            sys.exit(1)

        output_path = dispatch[chart_type](data, user_id)
        # Devolver ruta relativa para el navegador
        rel_path = '/charts/' + os.path.basename(output_path)
        print(json.dumps({'success': True, 'path': rel_path}))

    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
