import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Sparkles, Loader2, RotateCcw } from "lucide-react";
import { ASPECT_RATIOS, type AspectRatio } from "@/lib/constants";

interface PromptCardProps {
  prompt: string;
  negativePrompt: string;
  steps: number;
  width: number;
  height: number;
  selectedRatio: string;
  uhd: boolean;
  loading: boolean;
  setPrompt: (v: string) => void;
  setNegativePrompt: (v: string) => void;
  setSteps: (v: number) => void;
  setWidth: (v: number) => void;
  setHeight: (v: number) => void;
  handleRatioSelect: (ratio: AspectRatio) => void;
  handleUhdToggle: (enabled: boolean) => void;
  handleGenerate: () => void;
}

export function PromptCard({
  prompt,
  negativePrompt,
  steps,
  width,
  height,
  selectedRatio,
  uhd,
  loading,
  setPrompt,
  setNegativePrompt,
  setSteps,
  setWidth,
  setHeight,
  handleRatioSelect,
  handleUhdToggle,
  handleGenerate,
}: PromptCardProps) {
  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardContent className="p-5 space-y-4">
        <div>
          <Label className="text-zinc-300 text-sm font-medium">Prompt</Label>
          <Textarea
            rows={8}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="一张虚构的英语电影《回忆之味》（The Taste of Memory）的电影海报。场景设置在一个质朴的19世纪风格厨房里。画面中央，一位红棕色头发、留着小胡子的中年男子（演员阿瑟·彭哈利根饰）站在一张木桌后，他身穿白色衬衫、黑色马甲和米色围裙，正看着一位女士，手中拿着一大块生红肉，下方是一个木制切菜板。在他的右边，一位梳着高髻的黑发女子（演员埃莉诺·万斯饰）倚靠在桌子上，温柔地对他微笑。她穿着浅色衬衫和一条上白下蓝的长裙。桌上除了放有切碎的葱和卷心菜丝的切菜板外，还有一个白色陶瓷盘、新鲜香草，左侧一个木箱上放着一串深色葡萄。背景是一面粗糙的灰白色抹灰墙，墙上挂着一幅风景画。最右边的一个台面上放着一盏复古油灯。海报上有大量的文字信息。左上角是白色的无衬线字体\"ARTISAN FILMS PRESENTS\"，其下方是\"ELEANOR VANCE\"和\"ACADEMY AWARD® WINNER\"。右上角写着\"ARTHUR PENHALIGON\"和\"GOLDEN GLOBE® AWARD WINNER\"。顶部中央是圣丹斯电影节的桂冠标志，下方写着\"SUNDANCE FILM FESTIVAL GRAND JURY PRIZE 2024\"。主标题\"THE TASTE OF MEMORY\"以白色的大号衬线字体醒目地显示在下半部分。标题下方注明了\"A FILM BY Tongyi Interaction Lab\"。底部区域用白色小字列出了完整的演职员名单，包括\"SCREENPLAY BY ANNA REID\"、\"CULINARY DIRECTION BY JAMES CARTER\"以及Artisan Films、Riverstone Pictures和Heritage Media等众多出品公司标志。整体风格是写实主义，采用温暖柔和的灯光方案，营造出一种亲密的氛围。色调以棕色、米色和柔和的绿色等大地色系为主。"
            className="mt-2 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 resize-none overflow-y-auto max-h-48"
          />
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="advanced" className="border-zinc-800">
            <AccordionTrigger className="text-zinc-400 text-sm hover:no-underline py-2">
              Advanced Settings
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-zinc-400 text-xs">
                    Negative Prompt
                  </Label>
                  <Textarea
                    rows={2}
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    className="mt-1 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 resize-none"
                  />
                </div>
                <div>
                  <Label className="text-zinc-400 text-xs flex items-center gap-2">
                    <RotateCcw
                      className="w-3 h-3 cursor-pointer hover:text-orange-400"
                      onClick={() => setSteps(9)}
                    />
                    Inference Steps:{" "}
                    <span className="text-orange-400 font-mono">{steps}</span>
                  </Label>
                  <Slider
                    value={[steps]}
                    onValueChange={(v) => setSteps(v[0])}
                    min={1}
                    max={50}
                    step={1}
                    className="mt-2 bg-orange-500"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-zinc-300 text-sm font-medium">
              Aspect Ratio
            </Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="uhd" className="text-zinc-400 text-xs">
                  UHD / 2K
                </Label>
                <Switch
                  id="uhd"
                  checked={uhd}
                  className={`data-[state=unchecked]:[&>span]:bg-zinc-500 data-[state=checked]:[&>span]:bg-yellow-400 uhd ? "bg-orange-500" : "border-xl border-zinc-800"`}
                  onCheckedChange={handleUhdToggle}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {ASPECT_RATIOS.map((ratio) => {
              const Icon = ratio.icon;
              const isSelected = selectedRatio === ratio.label;
              return (
                <button
                  key={ratio.label}
                  onClick={() => handleRatioSelect(ratio)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg border transition-all ${
                    isSelected
                      ? "bg-orange-500/10 border-orange-500 text-orange-400"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{ratio.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-zinc-400 text-xs flex items-center gap-2">
              <RotateCcw
                className="w-3 h-3 cursor-pointer hover:text-orange-400"
                onClick={() => {
                  const ratio = ASPECT_RATIOS.find(
                    (r) => r.label === selectedRatio
                  );
                  if (ratio)
                    setWidth(uhd ? ratio.presets[1].w : ratio.presets[0].w);
                }}
              />
              Width:{" "}
              <span className="text-orange-400 font-mono">{width}px</span>
            </Label>
            <Slider
              value={[width]}
              onValueChange={(v) => setWidth(v[0])}
              min={512}
              max={2048}
              step={64}
              className="mt-2 bg-orange-500"
            />
          </div>
          <div>
            <Label className="text-zinc-400 text-xs flex items-center gap-2">
              <RotateCcw
                className="w-3 h-3 cursor-pointer hover:text-orange-400"
                onClick={() => {
                  const ratio = ASPECT_RATIOS.find(
                    (r) => r.label === selectedRatio
                  );
                  if (ratio)
                    setHeight(uhd ? ratio.presets[1].h : ratio.presets[0].h);
                }}
              />
              Height:{" "}
              <span className="text-orange-400 font-mono">{height}px</span>
            </Label>
            <Slider
              value={[height]}
              onValueChange={(v) => setHeight(v[0])}
              min={512}
              max={2048}
              step={64}
              className="mt-2 bg-orange-500"
            />
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Image
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
