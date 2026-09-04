/**
 * Imports the 13 inline SVG figures from the user's A3 reference. Usage:
 *
 *   node scripts/import-training-figures.mjs /path/to/training-figures-a3.html
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const input = process.argv[2]
if (!input) throw new Error('Pass the path to training-figures-a3.html')

const OUTPUT = new URL('../public/exercise-demos/', import.meta.url)
const figures = {
  '前抱深蹲': 'goblet-squat',
  '哑铃平板卧推': 'dumbbell-bench-press',
  引体向上: 'pull-up',
  '罗马尼亚硬拉': 'dumbbell-romanian-deadlift',
  '上斜哑铃卧推': 'incline-dumbbell-press',
  '哑铃弯举': 'bicep-curl',
  '坐姿哑铃推举': 'seated-dumbbell-press',
  '哑铃单臂划船': 'one-arm-dumbbell-row',
  '保加利亚剪蹲凳在身后': 'bulgarian-split-squat',
  '俯卧反向飞鸟后方视角': 'rear-delt-fly',
  '侧平举正面视角': 'lateral-raise',
  '仰卧哑铃臂屈伸': 'dumbbell-skull-crusher',
  '悬垂屈膝举腿': 'hanging-knee-raise',
}

const html = readFileSync(input, 'utf8')
const styles = html.match(/<style>([\s\S]*?)<\/style>/)?.[1]
if (!styles) throw new Error('Could not find the reference styles')
const marker = html.match(/<defs>([\s\S]*?)<\/defs>/)?.[1]
if (!marker) throw new Error('Could not find the reference arrow marker')
const cards = new Map(
  [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<svg([^>]*)>([\s\S]*?)<\/svg>/g)].map((match) => [
    match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '').replace(/^[AB]\d+/, ''),
    { attributes: match[2], body: match[3] },
  ]),
)

mkdirSync(OUTPUT, { recursive: true })
for (const [name, slug] of Object.entries(figures)) {
  const figure = cards.get(name)
  if (!figure) throw new Error(`Could not find ${name} in the reference`)
  const directory = new URL(`${slug}/`, OUTPUT)
  mkdirSync(directory, { recursive: true })
  const svg = (hidden) =>
    `<svg xmlns="http://www.w3.org/2000/svg"${figure.attributes}><style><![CDATA[${styles}\n${hidden}{visibility:hidden}]]></style><defs>${marker}</defs>${figure.body}</svg>`
  writeFileSync(new URL('frame-1.svg', directory), svg('.ac,.ac-h,.load,.pth,.lbl'))
  writeFileSync(new URL('frame-2.svg', directory), svg('.gh,.gh-h,.load-gh'))
}

console.log(`Imported ${Object.keys(figures).length} two-frame training figures.`)
