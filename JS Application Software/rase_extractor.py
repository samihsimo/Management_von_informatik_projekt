#!/usr/bin/env python3
import hashlib, json, re
from typing import Dict, List, Any

def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def extract_rules_mock(text: str) -> Dict[str, Any]:
    rules=[]; rule_id=1
    def add_rule(rase_type, source_text, data_metric, confidence=0.85, comparator=None, target=None, unit=None, paragraph=None, note=None):
        nonlocal rule_id
        rules.append({'id':f'rule-{rule_id:03d}','paragraph':paragraph,'rase_type':rase_type,'source_text':source_text.strip(),'data_metric':data_metric,'comparator':comparator,'target':target,'unit':unit,'confidence':confidence,'note':note})
        rule_id+=1
    normalized=' '.join(text.split())
    if 'Aufenthaltsräume' in normalized:
        add_rule('Applicability','Aufenthaltsräume','type==Aufenthaltsraeume',0.97,paragraph='Satz 1')
    if '2,40' in normalized or '2.40' in normalized:
        add_rule('Requirement','lichte Raumhöhe von mindestens 2,40 m','lichte_raumhoehe>=2.40m',0.98,comparator='>=',target='2.40',unit='m',paragraph='Satz 1')
    if 'Dachraum' in normalized:
        add_rule('Applicability','Aufenthaltsräume im Dachraum','type==AufenthaltsraeumeImDachraum',0.96,paragraph='Satz 2',note='Special case / lex specialis compared with the general 2.40 m rule.')
    if '2,20' in normalized or '2.20' in normalized:
        add_rule('Requirement','lichte Raumhöhe von mindestens 2,20 m','lichte_raumhoehe>=2.20m',0.98,comparator='>=',target='2.20',unit='m',paragraph='Satz 2')
    if 'Hälfte' in normalized or 'half' in normalized or '50' in normalized:
        add_rule('Requirement','mindestens der Hälfte ihrer Netto-Raumfläche','netto_raumflaeche>=0.50',0.94,comparator='>=',target='0.50',unit='ratio',paragraph='Satz 2')
    if '1,50' in normalized or '1.50' in normalized:
        add_rule('MeasurementLogic','Raumteile mit einer lichten Raumhöhe bis zu 1,50 m bleiben außer Betracht','measurement_logic: exclude_area_where_lichte_raumhoehe<=1.50m',0.91,comparator='<=',target='1.50',unit='m',paragraph='Satz 2',note='Not an independent RASE element; it defines calculation methodology.')
    if 'Gebäudeklassen 1 und 2' in normalized or 'Gebaeudeklassen 1 und 2' in normalized:
        add_rule('Exception','Wohngebäuden der Gebäudeklassen 1 und 2','gebaeude_klasse in {GK1,GK2}',0.98,paragraph='Satz 3',note='Sentences 1 and 2 do not apply.')
    if not rules:
        sentences=re.split(r'(?<=[.!?])\s+', text.strip())
        for s in sentences:
            low=s.lower()
            if not s.strip(): continue
            if any(k in low for k in ['must','shall','müssen','mindestens']): add_rule('Requirement',s,'generic_requirement=TRUE',0.70)
            elif any(k in low for k in ['except','gelten nicht','not required','nicht erforderlich']): add_rule('Exception',s,'generic_exception=TRUE',0.70)
            else: add_rule('Applicability',s,'generic_scope=TRUE',0.55)
    return {'metadata':{'building_code_reference':'Musterbauordnung (MBO) §47 / Custom input','model':'mock-mode','ai_confidence_level':round(sum(r['confidence'] for r in rules)/len(rules),2) if rules else 0,'input_hash':sha256_text(text),'mode':'mock'},'rules':rules}

def extract_rules_live(text: str)->Dict[str,Any]:
    result=extract_rules_mock(text); result['metadata']['model']='live-mode-placeholder'; result['metadata']['mode']='live-placeholder'; return result

def extract(text: str, mode: str='mock')->Dict[str,Any]:
    return extract_rules_live(text) if mode=='live' else extract_rules_mock(text)

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(); parser.add_argument('file',nargs='?'); parser.add_argument('--mode',default='mock',choices=['mock','live']); args=parser.parse_args()
    txt=Path(args.file).read_text(encoding='utf-8') if args.file else input('Paste regulation text: ')
    print(json.dumps(extract(txt,args.mode),indent=2,ensure_ascii=False))
