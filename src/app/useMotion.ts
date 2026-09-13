
import { useLayoutEffect,type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)
export function usePageMotion(ref:RefObject<HTMLElement|null>,key:string){
 useLayoutEffect(()=>{
  if(!ref.current)return
  const media=gsap.matchMedia()
  media.add('(prefers-reduced-motion: no-preference)',()=>{
   const select=gsap.utils.selector(ref.current!)
   const tl=gsap.timeline({defaults:{ease:'power2.out'}})
   const headings=select('.page-heading > div, .page-heading > .button')
   if(headings.length)tl.from(headings,{y:13,autoAlpha:0,duration:.46,stagger:.08},0)
   const hero=select('.hero-copy > *, .hero-office, .template-banner > *')
   if(hero.length)tl.from(hero,{y:16,autoAlpha:0,duration:.56,stagger:.07},.08)
   const metrics=select('.metric')
   if(metrics.length)tl.from(metrics,{y:17,autoAlpha:0,duration:.48,stagger:.065},.23)
   const cards=select('.agent-card,.template-card,.workflow-card,.connection-card,.artifact-card,.scene-card,.approval-card,.settings-card,.overview-bottom > .panel,.overview-bottom > aside,.credit-panel,.budget-panel,.full-office')
   cards.forEach((card,i)=>gsap.from(card,{y:20,autoAlpha:0,duration:.52,delay:(i%4)*.055,ease:'power2.out',scrollTrigger:{trigger:card,start:'top 97%',once:true}}))
   const rows=select('.run-table tbody tr,.document-list > button,.office-roster > button')
   if(rows.length)tl.from(rows.slice(0,12),{y:8,autoAlpha:0,duration:.35,stagger:.035},.26)
   const counters=select('[data-metric-value]') as HTMLElement[]
   counters.forEach(el=>{const value={current:0};gsap.to(value,{current:Number(el.dataset.metricValue),duration:.65,delay:.35,onUpdate:()=>{el.textContent=Math.round(value.current).toString().padStart(2,'0')}})})
   return ()=>{counters.forEach(el=>{el.textContent=el.dataset.metricValue??''})}
  },ref)
  return ()=>media.revert()
 },[ref,key])
}
export function animateDialog(element:HTMLDialogElement){
 const media=gsap.matchMedia()
 media.add('(prefers-reduced-motion: no-preference)',()=>{gsap.fromTo(element,{y:17,opacity:0,scale:.98},{y:0,opacity:1,scale:1,duration:.24,ease:'power2.out',clearProps:'transform,opacity'})})
 return ()=>media.revert()
}
