import { eyebrow, h, p, button, note } from '../../emailTemplates.ts'
import { dash, esc, type CopyFn } from '../kit.ts'
import { shell, hi } from './kit.ts'

// ── Referrals (twin of ../referral.ts) ─────────────────────────────────────
export const REFERRAL: Record<string, CopyFn> = {

  referral_invite: (c) => {
    const code = c.referralCode ? p(`Your personal code: <b>${esc(c.referralCode)}</b>. Share it with anyone who manages property.`) : ''
    const reward = c.rewardLabel ? esc(c.rewardLabel) : 'a reward'
    return { subject: 'Recommend PROPERWISE to a property owner', html: shell({
      preheader: 'With every active referral, you gain too.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Referral programme') + h('Share something that helps you') + hi(c)
        + p(`Know someone with property who still struggles with notes and receipts? Recommend PROPERWISE to them. When they start, you earn ${reward}; they start with the trial, like every new account.`)
        + code
        + button('See the referral programme', dash(c))
        + note('The reward is secured once the new owner adds a property and scans their first document. It is credited to your subscription.'),
    }) }
  },

  referral_reminder: (c) => {
    const code = c.referralCode ? p(`Your code is always here: <b>${esc(c.referralCode)}</b>.`) : ''
    return { subject: 'Your invitation link is waiting', html: shell({
      preheader: 'With every active referral, you gain too.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Referral programme') + h('Someone will be grateful to you') + hi(c)
        + p('The best recommendations come from people we trust. If PROPERWISE has made life easier for you, it may do the same for someone close to you.')
        + code
        + button('Send an invitation', dash(c))
        + note('We keep the reward for every active referral for you.'),
    }) }
  },

  referral_reward: (c) => {
    const reward = c.rewardLabel ? `<b>${esc(c.rewardLabel)}</b>` : 'Your reward'
    const who = c.friendName ? ` Thanks to your recommendation, ${esc(c.friendName)} started with PROPERWISE.` : ''
    return { subject: 'Your reward is ready', html: shell({
      preheader: 'Thank you for recommending us.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Reward') + h('You earned it, and thank you') + hi(c)
        + p(`${reward} has just been added to your account.${who}`)
        + p('Every referral builds a community of people who want their properties in order. We are glad you are part of it.')
        + button('See your reward', dash(c))
        + note('Want to carry on? Your link is always available.'),
    }) }
  },

  referral_friend_activated: (c) => {
    const who = c.friendName ? esc(c.friendName) : 'Someone'
    const reward = c.rewardLabel ? ` Your reward, ${esc(c.rewardLabel)}, is on its way.` : ''
    return { subject: 'Your referral has just been activated', html: shell({
      preheader: 'Good news from your invitation.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Referral programme') + h('Some good news') + hi(c)
        + p(`${who} started actively with PROPERWISE thanks to you.${reward}`)
        + p('A referral like yours means a lot to us. Thank you for sharing something that helps you.')
        + button('See your referrals', dash(c))
        + note('You can recommend PROPERWISE to as many people as you like.'),
    }) }
  },
}
