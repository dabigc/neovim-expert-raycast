call plug#begin('~/.vim/plugged')
Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'junegunn/fzf.vim'
Plug 'tpope/vim-fugitive'
nmap <leader>ff :Files<CR>
imap jj <Esc>
call plug#end()
set number
set relativenumber
