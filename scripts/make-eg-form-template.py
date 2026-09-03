"""Regenerate public/eg_form_template.docx from lib/eg_form_template.docx by
inserting {tag} placeholders into every value cell. Run after editing the
original template:  python3 scripts/make-eg-form-template.py"""
import re, zipfile, shutil, sys
import os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC=os.path.join(ROOT,"lib","eg_form_template.docx")
OUT=os.path.join(ROOT,"public","eg_form_template.docx")
RPR='<w:rPr><w:rFonts w:ascii="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>'
def run(tag): return f'<w:r>{RPR}<w:t xml:space="preserve">{{{tag}}}</w:t></w:r>'

z=zipfile.ZipFile(SRC)
doc=z.read('word/document.xml').decode('utf8')

tables=list(re.finditer(r'<w:tbl>.*?</w:tbl>',doc,re.S))
assert len(tables)==3

def fill_table(tbl_xml, plan):
    rows=list(re.finditer(r'<w:tr[ >].*?</w:tr>',tbl_xml,re.S))
    out=tbl_xml
    # process from the end so offsets stay valid
    for ri in sorted(plan, reverse=True):
        ci, mode, tag = plan[ri]
        r=rows[ri]; row=r.group(0)
        cells=list(re.finditer(r'<w:tc>.*?</w:tc>',row,re.S))
        c=cells[ci]; cell=c.group(0)
        p_end=cell.find('</w:p>')
        if mode=='append':
            new_cell=cell[:p_end]+run(tag)+cell[p_end:]
        elif mode=='replace_NA':
            assert '>NA<' in cell
            new_cell=cell.replace('>NA<', '>{'+tag+'}<')
        elif mode=='after_hk':
            assert '>HK$<' in cell
            new_cell=cell.replace('>HK$<', '>HK$ {'+tag+'}<')
        new_row=row[:c.start()]+new_cell+row[c.end():]
        out=out[:r.start()]+new_row+out[r.end():]
    return out

plan1={1:(1,'append','Applicant'),2:(1,'append','App_Cat'),3:(1,'append','App_PName'),
       4:(1,'append','D_ReqF_SWD'),5:(1,'append','D_PlnT_SWD'),6:(1,'append','Ref'),
       7:(1,'append','SWD_Off'),8:(1,'append','SWD_Off_I'),10:(1,'append','D_EGF_ASWD'),
       11:(1,'append','Staff'),12:(1,'append','Staff_Info')}
plan2={1:(2,'append','Q12a'),2:(2,'append','Q12b_Jus'),3:(2,'after_hk','Q12c_TotC'),
       4:(2,'append','Q12d_Quo'),5:(2,'append','Q12e_JCost'),6:(2,'replace_NA','Q12f_RReject'),
       7:(2,'append','Q12g_JRem')}
plan3={1:(2,'append','Q13a'),2:(2,'append','Q13b')}

new=doc
for m,plan in reversed(list(zip(tables,[plan1,plan2,plan3]))):
    new=new[:m.start()]+fill_table(m.group(0),plan)+new[m.end():]

zout=zipfile.ZipFile(OUT,'w',zipfile.ZIP_DEFLATED)
for item in z.infolist():
    data=z.read(item.filename)
    if item.filename=='word/document.xml': data=new.encode('utf8')
    zout.writestr(item,data)
zout.close()
print("tags:",re.findall(r'\{[A-Za-z0-9_]+\}',new))
