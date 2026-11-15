"""Run with the bundled documents Python runtime. Anonymous public proposal.
Private roster is deliberately supplied from a gitignored local JSON file.
"""
from pathlib import Path
import json
from copy import deepcopy
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'산출물'; CACHE=ROOT/'.cache/submission'
content=json.loads((ROOT/'tools/submission/proposal-content.json').read_text(encoding='utf-8-sig'))
sections=content['sections']
def meta(d):
    d.core_properties.author='Pleorder';d.core_properties.last_modified_by='Pleorder';d.core_properties.title='플레오더 기획서';d.core_properties.comments=''
def font(run,size=11,bold=False):
    run.font.name='맑은 고딕';run.font.size=Pt(size);run.bold=bold
    run._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'),'맑은 고딕')
def para(d,text,size=11):
    p=d.add_paragraph();font(p.add_run(text),size);p.paragraph_format.space_after=Pt(7);p.paragraph_format.line_spacing=1.2;return p
def section(d,n,page=False):
    d.add_heading(f'{n+1} {sections[n]["title"]}',1).paragraph_format.page_break_before=page
    for line in sections[n]['text'].split('\n'):para(d,line)
def table(d,heads,rows,widths):
    t=d.add_table(rows=1,cols=len(heads));t.autofit=False
    for i,w in enumerate(widths):t.columns[i].width=Inches(w)
    for i,v in enumerate(heads):t.rows[0].cells[i].text=v
    for row in rows:
        cells=t.add_row().cells
        for i,v in enumerate(row):cells[i].text=str(v)
    for ri,row in enumerate(t.rows):
        for ci,c in enumerate(row.cells):
            c.width=Inches(widths[ci]);c.vertical_alignment=1
            pr=c._tc.get_or_add_tcPr();sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'173C52' if ri==0 else ('F2F5F7' if ri%2==0 else 'FFFFFF'));pr.append(sh)
            b=OxmlElement('w:tcBorders')
            for edge in ['top','left','bottom','right']:
                e=OxmlElement('w:'+edge);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');b.append(e)
            pr.append(b)
            margins=OxmlElement('w:tcMar')
            for side in ['top','left','bottom','right']:
                e=OxmlElement('w:'+side);e.set(qn('w:w'),'100');e.set(qn('w:type'),'dxa');margins.append(e)
            pr.append(margins)
            for p in c.paragraphs:
                p.paragraph_format.space_after=Pt(3)
                for r in p.runs:font(r,10,ri==0);r.font.color.rgb=RGBColor.from_string('FFFFFF' if ri==0 else '000000')
    t.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
    d.add_paragraph()
    return t
def pic(d,name,caption,width=6.65):
    path=CACHE/(name+'.png')
    if path.exists():d.add_picture(str(path),width=Inches(width));para(d,caption,9)

public=Document();meta(public)
s=public.sections[0];s.page_width=Inches(8.2677);s.page_height=Inches(11.6929);s.top_margin=Inches(.72);s.bottom_margin=Inches(.7);s.left_margin=s.right_margin=Inches(.8)
for name in ['Normal','Title','Heading 1','Heading 2']:
    st=public.styles[name];st.font.name='맑은 고딕';st.font.color.rgb=RGBColor(0,0,0);st._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'),'맑은 고딕')
public.styles['Normal'].font.size=Pt(11)
public.styles['Title'].font.size=Pt(28)
public.styles['Heading 1'].font.size=Pt(17)
public.styles['Heading 1'].paragraph_format.space_after=Pt(12)
p=s.footer.paragraphs[0];p.alignment=2;font(p.add_run('플레오더  ·  '),9)
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');p._p.append(field)
for st in public.styles:
    for border in list(st._element.xpath('.//w:pBdr')):border.getparent().remove(border)
public.add_paragraph('플레오더 기획서',style='Title')
para(public,'현대자동차그룹 차량용 앱 개발 공모전 심사 자료',11)
para(public,'공개 심사용  |  2026년 11월 15일  |  주문과 결제는 시뮬레이션',10)
section(public,0)
pic(public,'home','그림 1  실제 에뮬레이터의 주차 화면  ·  가상 매장 예시와 네이버 지도')
public.add_heading('2 기획 배경',1)
para(public,'귀가 후 주문하면 식사를 기다리고, 너무 일찍 주문하면 음식이 먼저 도착합니다. 여행 중에는 숙소를 기준으로 가게를 찾아야 하며, 픽업에는 직선거리보다 경유 부담이 중요합니다. 플레오더는 목적지와 도착 예상 시간을 주문에 연결해 이 간극을 줄이고자 합니다. 효과는 화면 조작 횟수와 음성 과업 완료율로 검증할 계획입니다.')
section(public,2,True)
table(public,['고객 상황','차량 맥락','앱의 대응'],[
 ('퇴근 후 식사','도착 예상 시각','전송 시점 조절과 예약 보류'),('가는 길 픽업','현재 위치와 목적지 경로','경유 추가 거리와 시간'),('숙소 배달','차량의 새 목적지','배송지 확인과 주변 매장 추천'),('운전 중 주문','실제 UX 제한 비트','DO 화면에서 음성 확인')],[1.35,1.8,3.5])
para(public,'차별점은 배달 목록 자체가 아니라 목적지와 주문 시점을 연결하는 흐름입니다. 추천 결과, 주문 내용, 결제 승인을 분리해 잘못 인식한 말이 곧바로 결제로 이어지지 않게 합니다.')
section(public,3,True);pic(public,'traffic-retimed','그림 2  시험 ETA 지연에 따른 예약 전송 조정  ·  추가 모의 결제 없음',4.15)
section(public,4,True)
section(public,5,True)
table(public,['검증 가설','초기 목표','측정 방식'],[
 ('월 활성 이용자','MAU 1,000명','20,000 × 10% × 50% 가정'),('30일 후 재사용','D30 25%','첫 사용 후 30일 코호트'),('반복 사용','월 2회 이상 30%','완료 주문 사용자 중 비율'),('잘못된 승인','중복 결제 0건 목표','거래 키와 승인 이벤트 대조')],[1.8,1.7,3.15])
para(public,'위 수치는 제품 출시 이후 검증할 가정이며 현재 실적이나 시장점유율 전망이 아닙니다. 음성으로 주문하는 편의가 실제로 재사용으로 이어지는지 먼저 확인합니다.',10)
public.add_heading('7 참고자료',1).paragraph_format.page_break_before=True
para(public,'소스·APK·영상: https://github.com/kjhk3082/pleorder\n저장소 README에 재생 영상과 최신 release를 연결했습니다. 산출물 폴더에는 기획서, 자막, 검증 결과와 제출 기준을 함께 제공합니다.')
para(public,'영상은 실제 에뮬레이터 화면과 합성 음성 내레이션으로 구성했습니다. 정체 장면에는 시험 ETA와 시간 가속을 사용했습니다. Gleo 연결 장면은 11월 15일 에뮬레이터의 release 0.2.2 화면입니다. 11월 12일 debug 음성 기록과 최신 release 검증 범위를 구분하며, 실차·실결제 검증을 의미하지 않습니다.')
section(public,7)
public.add_heading('검증과 출처',1)
para(public,'검증 결과와 재현 범위는 산출물/03_검증자료/검증결과.md에 정리했습니다. 단위·회귀 검사, 실제 에뮬레이터 확인, 기존 연구 기록을 구분합니다. 영상에서 확인하지 않은 모든 예외 상황을 촬영 완료했다고 주장하지 않습니다.')
for label,url in [('제출 기준','https://appdevchallenge.auto-hmg.io/guide/submission'),('심사 기준','https://appdevchallenge.auto-hmg.io/guide/judging-awards'),('공개 SDK 개발 범위','https://appdevchallenge.auto-hmg.io/notice/c0a1a000-2026-4923-8000-000000000008'),('Pleos UI 가이드','https://document.pleos.ai/docs/connect/guide/docs-design/Introduction/intro'),('운전자 주의분산 가이드','https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/driver-distraction-guideline')]:
    p=para(public,label+'  '+url,8.5);p.paragraph_format.space_after=Pt(5)
public_path=OUT/'01_기획서/플레오더_기획서.docx';public.save(public_path)

private=Document(CACHE/'official/contest-application-consent.docx');meta(private)
roster=json.loads((CACHE/'roster.json').read_text(encoding='utf-8-sig'))
ps=private.paragraphs
replacement={9:'참가 단위: □ 개인           ☑ 팀',10:'참가 부문: ☑ 대학(원)생    □ 일반(스타트업 포함)',11:'팀명(개인 참가 시 성명): 플레오더',12:'앱명 / 프로젝트명: 플레오더',13:f'대표자 성명: {roster[0]}   역할: 대표자',17:'참가 인원: 5명',18:'작성일: 2026년 11월 15일',28:'앱명 / 프로젝트명: 플레오더',66:'앱명 / 프로젝트명: 플레오더',67:'팀명(팀 참가 시): 플레오더'}
for i,text in replacement.items():
    ps[i].text=text
    for r in ps[i].runs:font(r,10)
# Keep the two original privacy notes with the first-page roster.
for p in ps[:27]:
    p.paragraph_format.space_after=Pt(4)
    p.paragraph_format.line_spacing=1.05
for n,name in enumerate(roster,1):
    private.tables[0].rows[n].cells[0].text=name
    private.tables[9].rows[n].cells[1].text=name
for i,item in enumerate(sections,1):
    cell=private.tables[i].cell(0,0)
    # Remove the original empty content control; preserve the template cell formatting.
    for child in list(cell._tc):
        if child.tag!=qn('w:tcPr'):cell._tc.remove(child)
    answer = item['text']
    if item['title'] == '숏폼 링크':
        answer = 'Instagram 릴스 또는 YouTube Shorts 게시물 주소  ______________________________'
    for line in answer.split('\n'):
        p=cell.add_paragraph();font(p.add_run(line),10);p.paragraph_format.space_after=Pt(5);p.paragraph_format.line_spacing=1.12
    for tr in private.tables[i].rows:
        for h in list(tr._tr.xpath('./w:trPr/w:trHeight')):h.getparent().remove(h)
private.save(OUT/'비공개_접수용/플레오더_공식접수양식_서명전.docx')
(OUT/'01_기획서/플레오더_기획서.md').write_text('# 플레오더 기획서\n\n공개 심사용 · 2026-11-15\n\n'+'\n\n'.join('## '+str(i+1)+' '+x['title']+'\n\n'+x['text'] for i,x in enumerate(sections))+'\n',encoding='utf-8')
print('Created anonymous proposal and private unsigned application.')
