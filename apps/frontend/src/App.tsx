import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import { css } from '@emotion/react';
import { typography } from './styles/typography';

function App() {
    const [count, setCount] = useState(0);

    return (
        <>
            <div>
                <a href="https://vite.dev" target="_blank">
                    <img src={viteLogo} className="logo" alt="Vite logo" />
                </a>
                <a href="https://react.dev" target="_blank">
                    <img src={reactLogo} className="logo react" alt="React logo" />
                </a>
            </div>
            <h1 css={H1}>Vite + React</h1>
            <div className="card">
                <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
            </div>
            <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
        </>
    );
}

const H1 = css`
    font-size: ${typography['36ExtraBold'].fontSize};
    line-height: ${typography['36ExtraBold'].lineHeight};
    font-weight: ${typography['36ExtraBold'].fontWeight};
    color: #4e4866;
`;
export default App;
