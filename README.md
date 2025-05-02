# <img src="./public/favicon.ico" alt="Pockett logo" width="20" /> Pockett

[![Made with Next.js](https://img.shields.io/badge/Made%20with-Next.js-000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![PNPM](https://img.shields.io/badge/package%20manager-pnpm-F69220?logo=pnpm)](https://pnpm.io)
[![UI by shadcn](https://img.shields.io/badge/UI-shadcn%2Fui-8B5CF6?logo=storybook&logoColor=white)](https://ui.shadcn.com/)
[![License](https://img.shields.io/github/license/clementmoine/pockett)](LICENSE)

**Pockett** is a sleek, mobile-first Next.js app that keeps all your loyalty cards in your pocket. Add cards on the fly and export them to your mobile wallet when needed.

---

## ✨ Features

- 📱 Responsive UI built with [shadcn/ui](https://ui.shadcn.com)
- 🎟 Store unlimited loyalty cards
- 💳 Export to Apple Wallet / Google Wallet
- 🔐 Uses [addtowallet.co](https://addtowallet.co) for wallet passes
- 🛠 Requires an API key for wallet generation

---

## 🚀 Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the app.

Create a `.env.local` file:

```env
ADDTOWALLET_API_KEY=your_api_key_here
```

---

## 📸 Screenshots

<p align="center">
  <img src="./public/screenshots/narrow/home.png" alt="Home screen" width="200" style="display:inline-block; margin-right:10px;" />
  <img src="./public/screenshots/narrow/modal.png" alt="Modal view" width="200" style="display:inline-block;" />
</p>

---

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [addtowallet.co API](https://addtowallet.co)

---

## 📦 Deploy on Vercel

Deploy this project instantly with [Vercel](https://vercel.com/new?utm_source=create-next-app&utm_medium=readme):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

---

## 🧾 License

This project is licensed under the [MIT License](LICENSE).

---

Built with ❤️ using [Next.js](https://nextjs.org)
